import { describe, expect, it } from 'vitest'
import { createChart } from './chart'
import { cellAspectRatio, finishedSize, propertiesPatch, propertyError } from './chartProperties'
import { applyPatch, invertPatch } from './patch'

const now = new Date('2026-10-25T10:00:00.000Z')

describe('propertyError', () => {
  it('accepts a gauge, a major step and a ratio in range, fractions too', () => {
    expect(
      propertyError({
        gauge: { stitches: 22.5, rows: 30 },
        majorStep: 1,
        cellAspect: { mode: 'manual', ratio: 0.75 },
      }),
    ).toBeNull()
  })

  it('rejects a gauge of 0 or less', () => {
    expect(propertyError({ gauge: { stitches: 0, rows: 28 } })).toBe('gauge-not-positive')
    expect(propertyError({ gauge: { stitches: 20, rows: -1 } })).toBe('gauge-not-positive')
    expect(propertyError({ gauge: { stitches: Number.NaN, rows: 28 } })).toBe('gauge-not-positive')
  })

  it('rejects a major step below 1 or not whole', () => {
    expect(propertyError({ majorStep: 0 })).toBe('major-step-below-one')
    expect(propertyError({ majorStep: 2.5 })).toBe('major-step-below-one')
  })

  it('rejects a manual ratio of 0 or less', () => {
    expect(propertyError({ cellAspect: { mode: 'manual', ratio: 0 } })).toBe('aspect-not-positive')
    expect(propertyError({ cellAspect: { mode: 'auto' } })).toBeNull()
  })
})

describe('cellAspectRatio', () => {
  it('is rows over stitches of the gauge in «авто»: wider cells for more rows per 10 cm', () => {
    const { properties } = createChart(10, 10, now)

    expect(
      cellAspectRatio({
        ...properties,
        gauge: { stitches: 20, rows: 28 },
        cellAspect: { mode: 'auto' },
      }),
    ).toBeCloseTo(1.4)
  })

  it('is the ratio set by hand otherwise', () => {
    const { properties } = createChart(10, 10, now)

    expect(cellAspectRatio(properties)).toBe(1)
    expect(cellAspectRatio({ ...properties, cellAspect: { mode: 'manual', ratio: 0.8 } })).toBe(0.8)
  })
})

describe('finishedSize', () => {
  it('is 20 × ≈14.3 cm for 40×40 at 20×28', () => {
    const size = finishedSize({ width: 40, height: 40 }, { stitches: 20, rows: 28 })

    expect(size.width).toBe(20)
    expect(size.height).toBeCloseTo(14.29, 2)
  })
})

describe('propertiesPatch', () => {
  it('holds only the changed properties, which it sets and puts back when inverted', () => {
    const chart = createChart(10, 10, now)
    const before = chart.properties

    const patch = propertiesPatch(before, {
      title: 'Олени',
      majorStep: 10,
      numbering: { rows: 'top-down', stitches: 'right-to-left' },
    })

    expect(patch).toEqual({
      kind: 'properties',
      before: { title: '', numbering: { rows: 'bottom-up', stitches: 'right-to-left' } },
      after: { title: 'Олени', numbering: { rows: 'top-down', stitches: 'right-to-left' } },
    })
    applyPatch(chart, patch!)
    expect(chart.properties).toEqual({
      ...before,
      title: 'Олени',
      numbering: { rows: 'top-down', stitches: 'right-to-left' },
    })

    applyPatch(chart, invertPatch(patch!))
    expect(chart.properties).toEqual(before)
  })

  it('is null when nothing changes', () => {
    const { properties } = createChart(10, 10, now)

    expect(propertiesPatch(properties, { gauge: { stitches: 20, rows: 28 }, title: '' })).toBeNull()
  })
})
