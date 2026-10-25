import * as v from 'valibot'
import type {
  ChartFileFormat,
  KchartCorruption,
  KchartError,
  KchartResult,
} from '../application/chartFile'
import type { Chart } from '../domain/chart'
import { MAX_CHART_DIMENSION } from '../domain/chartSize'
import { FILL_PATTERNS } from '../domain/fillPattern'
import { MAX_PALETTE_SIZE, type Palette, type YarnId } from '../domain/palette'

/** The `.kchart` format version this editor writes (spec, «Файл схемы .kchart»; ADR-0005). */
export const KCHART_VERSION = 1

const positive = v.pipe(v.number(), v.finite(), v.gtValue(0))
const count = v.pipe(v.number(), v.integer(), v.minValue(0))
const countFromOne = v.pipe(v.number(), v.integer(), v.minValue(1))
const timestamp = v.pipe(v.string(), v.isoTimestamp(), v.endsWith('Z'))

/** Version 1 as it is checked after migrations: unknown fields pass and are dropped. */
const documentV1 = v.object({
  format: v.literal('kchart'),
  version: v.literal(1),
  properties: v.object({
    title: v.string(),
    notes: v.string(),
    gauge: v.object({ stitches: positive, rows: positive }),
    cellAspect: v.variant('mode', [
      v.object({ mode: v.literal('auto') }),
      v.object({ mode: v.literal('manual'), ratio: positive }),
    ]),
    numbering: v.object({
      rows: v.picklist(['bottom-up', 'top-down']),
      stitches: v.picklist(['right-to-left', 'left-to-right']),
    }),
    majorStep: countFromOne,
    createdAt: timestamp,
    modifiedAt: timestamp,
  }),
  palette: v.pipe(
    v.array(
      v.object({
        color: v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/i)),
        pattern: v.nullable(v.picklist(FILL_PATTERNS)),
        name: v.optional(v.string()),
      }),
    ),
    v.minLength(1),
  ),
  grid: v.object({
    width: countFromOne,
    height: countFromOne,
    /** Rows top first, each `[number, length, …]`; number 0 is an empty cell. */
    rows: v.array(
      v.pipe(
        v.array(count),
        v.check((row) => row.length % 2 === 0),
      ),
    ),
  }),
})

export type KchartDocument = v.InferOutput<typeof documentV1>

/** Pure steps `vN → vN+1` over raw JSON: `MIGRATIONS[N - 1]` lifts version N. None yet. */
const MIGRATIONS: readonly ((document: Record<string, unknown>) => Record<string, unknown>)[] = []

/** The chart as a version 1 document: yarn numbers instead of ids, rows in RLE, keys in file order. */
export function toKchartDocument(chart: Chart): KchartDocument {
  const numbers = new Map<YarnId, number>(chart.palette.map((y, i) => [y.id, i + 1]))
  const { properties: p } = chart
  const rows: number[][] = []
  for (let r = 0; r < chart.height; r++) {
    const row: number[] = []
    for (let c = 0; c < chart.width; c++) {
      const id = chart.cells[r * chart.width + c] ?? 0
      const number = id === 0 ? 0 : numbers.get(id)
      if (number === undefined)
        throw new RangeError(`Cell refers to yarn id ${id} not in the palette`)
      if (row[row.length - 2] === number) row[row.length - 1]!++
      else row.push(number, 1)
    }
    rows.push(row)
  }
  return {
    format: 'kchart',
    version: 1,
    properties: {
      title: p.title,
      notes: p.notes,
      gauge: { stitches: p.gauge.stitches, rows: p.gauge.rows },
      cellAspect:
        p.cellAspect.mode === 'auto'
          ? { mode: 'auto' }
          : { mode: 'manual', ratio: p.cellAspect.ratio },
      numbering: { rows: p.numbering.rows, stitches: p.numbering.stitches },
      majorStep: p.majorStep,
      createdAt: p.createdAt.toISOString(),
      modifiedAt: p.modifiedAt.toISOString(),
    },
    palette: chart.palette.map((y) => ({
      color: y.color,
      pattern: y.pattern,
      ...(y.name === '' ? {} : { name: y.name }),
    })),
    grid: { width: chart.width, height: chart.height, rows },
  }
}

/** The `.kchart` text: formatted JSON, an object or array of plain values on one line (so each row is one line). */
export function writeKchart(chart: Chart): string {
  return formatJson(toKchartDocument(chart), '') + '\n'
}

/** `<title>.kchart`, or `схема.kchart` when the title is empty. */
export function kchartFileName(chart: Chart): string {
  return `${chart.properties.title.trim() || 'схема'}.kchart`
}

/** The serializer as the application's chart file port. */
export const kchartFormat: ChartFileFormat = {
  write: (chart) => ({ name: kchartFileName(chart), text: writeKchart(chart) }),
  read: readKchart,
  toDocument: toKchartDocument,
  readDocument: readKchartDocument,
}

/** Imports a `.kchart` text; a byte order mark is allowed. */
export function readKchart(text: string): KchartResult {
  let document: unknown
  try {
    document = JSON.parse(text.startsWith('\uFEFF') ? text.slice(1) : text)
  } catch {
    return failure({ code: 'not-kchart' })
  }
  return readKchartDocument(document)
}

/** Imports a parsed document, such as the autosave record: format, version, migrations, checks. */
export function readKchartDocument(document: unknown): KchartResult {
  if (!isRecord(document) || document.format !== 'kchart') return failure({ code: 'not-kchart' })
  const { version } = document
  const known = Number.isInteger(version) ? (version as number) : null
  if (known !== null && known > KCHART_VERSION) return failure({ code: 'newer-version' })
  let migrated = document
  if (known !== null && known >= 1) {
    for (const migrate of MIGRATIONS.slice(known - 1)) migrated = migrate(migrated)
  }

  const parsed = v.safeParse(documentV1, migrated, { abortEarly: true })
  if (!parsed.success) {
    const field = (parsed.issues[0].path ?? [])
      .map((item) => (typeof item.key === 'number' ? item.key + 1 : String(item.key)))
      .join('.')
    return corrupt({ kind: 'invalid-field', field })
  }
  return toChart(parsed.output)
}

function toChart({ properties: p, palette, grid }: KchartDocument): KchartResult {
  const { width, height, rows } = grid
  if (width > MAX_CHART_DIMENSION || height > MAX_CHART_DIMENSION)
    return failure({ code: 'too-large' })
  if (palette.length > MAX_PALETTE_SIZE) return failure({ code: 'too-many-yarns' })
  if (rows.length !== height)
    return corrupt({ kind: 'row-count', rows: rows.length, expected: height })

  // Yarn id = yarn number on import (ADR-0004), so the numbers go to the cells as they are.
  const cells = new Uint16Array(width * height)
  for (const [r, row] of rows.entries()) {
    let length = 0
    for (let i = 0; i < row.length; i += 2) {
      const yarn = row[i]!
      if (yarn > palette.length) {
        return corrupt({ kind: 'yarn-number', row: r + 1, yarn, paletteSize: palette.length })
      }
      length += row[i + 1]!
    }
    if (length !== width)
      return corrupt({ kind: 'row-length', row: r + 1, length, expected: width })
    let column = r * width
    for (let i = 0; i < row.length; i += 2) {
      cells.fill(row[i]!, column, column + row[i + 1]!)
      column += row[i + 1]!
    }
  }

  const chartPalette: Palette = palette.map((y, i) => ({
    id: i + 1,
    color: y.color.toLowerCase(),
    pattern: y.pattern,
    name: y.name ?? '',
  }))
  return {
    ok: true,
    chart: {
      width,
      height,
      cells,
      palette: chartPalette,
      properties: {
        title: p.title,
        notes: p.notes,
        gauge: p.gauge,
        cellAspect: p.cellAspect,
        numbering: p.numbering,
        majorStep: p.majorStep,
        createdAt: new Date(p.createdAt),
        modifiedAt: new Date(p.modifiedAt),
      },
    },
  }
}

function formatJson(value: unknown, indent: string): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  const entries: [string | null, unknown][] = Array.isArray(value)
    ? value.map((item) => [null, item])
    : Object.entries(value)
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  const key = (name: string | null) => (name === null ? '' : `${JSON.stringify(name)}: `)
  if (entries.every(([, item]) => item === null || typeof item !== 'object')) {
    const inner = entries.map(([name, item]) => key(name) + JSON.stringify(item)).join(', ')
    return Array.isArray(value) ? `[${inner}]` : `{ ${inner} }`
  }
  const nested = indent + '  '
  const lines = entries.map(([name, item]) => nested + key(name) + formatJson(item, nested))
  return `${open}\n${lines.join(',\n')}\n${indent}${close}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function corrupt(detail: KchartCorruption): KchartResult {
  return failure({ code: 'corrupt', detail })
}

function failure(error: KchartError): KchartResult {
  return { ok: false, error }
}
