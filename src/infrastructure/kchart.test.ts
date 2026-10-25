import { describe, expect, it } from 'vitest'
import { createChart, type Chart } from '../domain/chart'
import type { Palette } from '../domain/palette'
import {
  kchartFileName,
  readKchart,
  readKchartDocument,
  toKchartDocument,
  writeKchart,
  type KchartError,
  type KchartResult,
} from './kchart'

const fixtures = import.meta.glob<string>('../../fixtures/kchart/v1/*.kchart', {
  query: '?raw',
  import: 'default',
  eager: true,
})

function fixture(name: string): string {
  const text = fixtures[`../../fixtures/kchart/v1/${name}.kchart`]
  if (text === undefined) throw new Error(`No fixture ${name}`)
  return text
}

const validFixtures = Object.keys(fixtures)
  .map((path) => /\/(valid-[^/]+)\.kchart$/.exec(path)?.[1])
  .filter((name) => name !== undefined)

function chartOf(result: KchartResult): Chart {
  if (!result.ok) throw new Error(`Rejected: ${JSON.stringify(result.error)}`)
  return result.chart
}

function errorOf(result: KchartResult): KchartError {
  if (result.ok) throw new Error('Accepted')
  return result.error
}

/** The chart as the user sees it: cells by yarn number, ids left out (ADR-0004). */
function byYarnNumbers(chart: Chart) {
  const numbers = new Map(chart.palette.map((y, i) => [y.id, i + 1]))
  return {
    width: chart.width,
    height: chart.height,
    cells: [...chart.cells].map((id) => (id === 0 ? 0 : numbers.get(id))),
    palette: chart.palette.map(({ color, pattern, name }) => ({ color, pattern, name })),
    properties: chart.properties,
  }
}

/** The spec example (4×2) as a document object, to vary one field at a time. */
function example(): Record<string, unknown> & {
  properties: Record<string, unknown>
  palette: Record<string, unknown>[]
  grid: { width: unknown; height: unknown; rows: unknown[] }
} {
  return JSON.parse(fixture('valid-deer-4x2'))
}

describe('fixtures', () => {
  it('reads the spec example 4×2', () => {
    const chart = chartOf(readKchart(fixture('valid-deer-4x2')))

    expect(chart.width).toBe(4)
    expect(chart.height).toBe(2)
    expect(chart.palette).toEqual([
      { id: 1, color: '#f4f1ea', pattern: null, name: '' },
      { id: 2, color: '#b22222', pattern: 'cross', name: 'Alize Lanagold 56' },
    ])
    expect([...chart.cells]).toEqual([1, 1, 1, 1, 0, 2, 2, 1])
    expect(chart.properties).toEqual({
      title: 'Олени',
      notes: '',
      gauge: { stitches: 22.5, rows: 30 },
      cellAspect: { mode: 'auto' },
      numbering: { rows: 'bottom-up', stitches: 'right-to-left' },
      majorStep: 10,
      createdAt: new Date('2026-10-25T10:00:00.000Z'),
      modifiedAt: new Date('2026-10-25T11:30:00.000Z'),
    })
  })

  it('covers all four numbering directions and both cell aspect modes', () => {
    const charts = validFixtures.map((name) => chartOf(readKchart(fixture(name))))
    const numberings = new Set(
      charts.map(({ properties: { numbering } }) => `${numbering.rows} ${numbering.stitches}`),
    )
    const aspects = new Set(charts.map((c) => c.properties.cellAspect.mode))

    expect(numberings.size).toBe(4)
    expect(aspects).toEqual(new Set(['auto', 'manual']))
  })

  it.each(validFixtures)('writes %s back to the same text', (name) => {
    const text = fixture(name)

    expect(writeKchart(chartOf(readKchart(text)))).toBe(text)
  })

  it.each([
    ['broken-not-kchart', 'not-kchart'],
    ['broken-newer-version', 'newer-version'],
    ['broken-corrupt', 'corrupt'],
    ['broken-too-large', 'too-large'],
    ['broken-too-many-yarns', 'too-many-yarns'],
  ] as const)('%s fails as %s', (name, code) => {
    expect(errorOf(readKchart(fixture(name))).code).toBe(code)
  })

  it('names the broken row of the corrupt sample', () => {
    expect(errorOf(readKchart(fixture('broken-corrupt')))).toEqual({
      code: 'corrupt',
      detail: { kind: 'row-length', row: 2, length: 3, expected: 4 },
    })
  })
})

describe('writeKchart', () => {
  /** A 3×2 chart whose palette order differs from its ids, so numbers and ids disagree. */
  function reordered(): Chart {
    const chart = createChart(3, 2, new Date('2026-10-25T10:00:00.000Z'))
    const palette: Palette = [
      { id: 3, color: '#ff0000', pattern: 'plus', name: 'Красная' },
      { id: 1, color: '#ffffff', pattern: 'cross', name: '' },
      { id: 2, color: '#000000', pattern: null, name: '' },
    ]
    chart.cells.set([3, 3, 0, 1, 2, 2])
    return {
      ...chart,
      palette,
      properties: {
        ...chart.properties,
        title: 'Шапка',
        modifiedAt: new Date('2026-10-26T00:00:00Z'),
      },
    }
  }

  it('gives back an equal chart by yarn numbers after a round trip', () => {
    const chart = reordered()

    const back = chartOf(readKchart(writeKchart(chart)))

    expect(byYarnNumbers(back)).toEqual(byYarnNumbers(chart))
    expect(back.palette.map((y) => y.id)).toEqual([1, 2, 3])
  })

  it('writes cells as yarn numbers in RLE, rows top first, name only when not empty', () => {
    const document = toKchartDocument(reordered())

    expect(document.grid).toEqual({
      width: 3,
      height: 2,
      rows: [
        [1, 2, 0, 1],
        [2, 1, 3, 2],
      ],
    })
    expect(document.palette).toEqual([
      { color: '#ff0000', pattern: 'plus', name: 'Красная' },
      { color: '#ffffff', pattern: 'cross' },
      { color: '#000000', pattern: null },
    ])
    expect(document.properties.modifiedAt).toBe('2026-10-26T00:00:00.000Z')
  })

  it('writes the document object that reads back like the file', () => {
    const chart = reordered()

    expect(byYarnNumbers(chartOf(readKchartDocument(toKchartDocument(chart))))).toEqual(
      byYarnNumbers(chart),
    )
  })
})

describe('kchartFileName', () => {
  it('is the title with .kchart, or «схема.kchart» for an empty title', () => {
    const chart = createChart(1, 1, new Date(0))

    expect(kchartFileName({ ...chart, properties: { ...chart.properties, title: 'Олени' } })).toBe(
      'Олени.kchart',
    )
    expect(kchartFileName(chart)).toBe('схема.kchart')
    expect(kchartFileName({ ...chart, properties: { ...chart.properties, title: '  ' } })).toBe(
      'схема.kchart',
    )
  })
})

describe('readKchart tolerances', () => {
  it('skips a byte order mark', () => {
    expect(readKchart('﻿' + fixture('valid-deer-4x2')).ok).toBe(true)
  })

  it('reads hex in any case as lower case', () => {
    const document = example()
    document.palette[1] = { color: '#B2a2F2', pattern: 'cross' }

    expect(chartOf(readKchartDocument(document)).palette[1]?.color).toBe('#b2a2f2')
  })

  it('reads RLE pairs of length 0 and neighbouring pairs with one number', () => {
    const document = example()
    document.grid.rows = [
      [1, 1, 2, 0, 1, 3],
      [0, 0, 0, 1, 2, 1, 2, 1, 1, 1],
    ]

    expect([...chartOf(readKchartDocument(document)).cells]).toEqual([1, 1, 1, 1, 0, 2, 2, 1])
  })

  it('ignores unknown fields', () => {
    const document = example()
    document.extra = true
    document.properties.zoom = 4
    document.palette[0] = { color: '#ffffff', pattern: null, weight: 'DK' }

    expect(chartOf(readKchartDocument(document)).palette[0]).toEqual({
      id: 1,
      color: '#ffffff',
      pattern: null,
      name: '',
    })
  })

  it('reads a yarn with an empty name as a yarn without a name', () => {
    const document = example()
    document.palette[0] = { color: '#ffffff', pattern: null, name: '' }

    expect(chartOf(readKchartDocument(document)).palette[0]?.name).toBe('')
  })

  it('reads the largest chart 500×500', () => {
    const document = example()
    document.grid = { width: 500, height: 500, rows: Array.from({ length: 500 }, () => [1, 500]) }

    expect(chartOf(readKchartDocument(document)).cells.length).toBe(250_000)
  })
})

describe('readKchart refusals', () => {
  it('is not a chart file when the text is not JSON', () => {
    expect(errorOf(readKchart('<svg/>'))).toEqual({ code: 'not-kchart' })
  })

  it.each([null, 7, 'kchart', [], {}, { format: 'KCHART', version: 1 }])(
    'is not a chart file without format «kchart»: %j',
    (document) => {
      expect(errorOf(readKchartDocument(document))).toEqual({ code: 'not-kchart' })
    },
  )

  it.each([
    [
      'a #rgb colour',
      (d: ReturnType<typeof example>) => (d.palette[0] = { color: '#fff', pattern: null }),
      'palette.1.color',
    ],
    [
      'an unknown pattern',
      (d: ReturnType<typeof example>) => (d.palette[1] = { color: '#000000', pattern: 'star' }),
      'palette.2.pattern',
    ],
    [
      'a fractional length',
      (d: ReturnType<typeof example>) => (d.grid.rows[0] = [1, 3.5, 1, 0.5]),
      'grid.rows.1.2',
    ],
    [
      'a negative length',
      (d: ReturnType<typeof example>) => (d.grid.rows[1] = [0, 1, 2, -2, 1, 5]),
      'grid.rows.2.4',
    ],
    [
      'a fractional number',
      (d: ReturnType<typeof example>) => (d.grid.rows[0] = [1.5, 4]),
      'grid.rows.1.1',
    ],
    [
      'a negative number',
      (d: ReturnType<typeof example>) => (d.grid.rows[0] = [-1, 4]),
      'grid.rows.1.1',
    ],
    [
      'a string for a number',
      (d: ReturnType<typeof example>) => (d.grid.rows[0] = ['1', 4]),
      'grid.rows.1.1',
    ],
    [
      'a row of odd length',
      (d: ReturnType<typeof example>) => (d.grid.rows[0] = [1, 4, 1]),
      'grid.rows.1',
    ],
    ['an empty palette', (d: ReturnType<typeof example>) => (d.palette = []), 'palette'],
    [
      'a zero gauge',
      (d: ReturnType<typeof example>) => (d.properties.gauge = { stitches: 0, rows: 30 }),
      'properties.gauge.stitches',
    ],
    [
      'a fractional major step',
      (d: ReturnType<typeof example>) => (d.properties.majorStep = 2.5),
      'properties.majorStep',
    ],
    [
      'a date that is not ISO UTC',
      (d: ReturnType<typeof example>) => (d.properties.createdAt = 'вчера'),
      'properties.createdAt',
    ],
    ['a zero width', (d: ReturnType<typeof example>) => (d.grid.width = 0), 'grid.width'],
    [
      'a missing grid',
      (d: ReturnType<typeof example>) => delete (d as Record<string, unknown>).grid,
      'grid',
    ],
    ['a fractional version', (d: ReturnType<typeof example>) => (d.version = 1.5), 'version'],
  ])('is corrupt with %s', (_, change, field) => {
    const document = example()
    change(document)

    expect(errorOf(readKchartDocument(document))).toEqual({
      code: 'corrupt',
      detail: { kind: 'invalid-field', field },
    })
  })

  it('is corrupt with a number too big for JSON, which parses as Infinity', () => {
    const text = fixture('valid-deer-4x2').replace('"stitches": 22.5', '"stitches": 1e999')

    expect(errorOf(readKchart(text))).toEqual({
      code: 'corrupt',
      detail: { kind: 'invalid-field', field: 'properties.gauge.stitches' },
    })
  })

  it('is corrupt when the row count is not the height', () => {
    const document = example()
    document.grid.rows = [[1, 4]]

    expect(errorOf(readKchartDocument(document))).toEqual({
      code: 'corrupt',
      detail: { kind: 'row-count', rows: 1, expected: 2 },
    })
  })

  it('is corrupt when a row refers to a yarn the palette does not have', () => {
    const document = example()
    document.grid.rows[1] = [0, 1, 7, 3]

    expect(errorOf(readKchartDocument(document))).toEqual({
      code: 'corrupt',
      detail: { kind: 'yarn-number', row: 2, yarn: 7, paletteSize: 2 },
    })
  })

  it('is corrupt when a row sums to a different length than the width', () => {
    const document = example()
    document.grid.rows[0] = [1, 5]

    expect(errorOf(readKchartDocument(document))).toEqual({
      code: 'corrupt',
      detail: { kind: 'row-length', row: 1, length: 5, expected: 4 },
    })
  })

  it('is too large over 500 in either dimension', () => {
    const document = example()
    document.grid = { width: 1, height: 501, rows: Array.from({ length: 501 }, () => [1, 1]) }

    expect(errorOf(readKchartDocument(document))).toEqual({ code: 'too-large' })
  })

  it('is newer for a later version even when the rest is unknown', () => {
    expect(errorOf(readKchartDocument({ format: 'kchart', version: 3 }))).toEqual({
      code: 'newer-version',
    })
  })
})
