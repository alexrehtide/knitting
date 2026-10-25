import type { Chart } from '../domain/chart'

/** Why a file is corrupt; rows and yarns are numbered from 1, rows in file order from the top. */
export type KchartCorruption =
  /** A field is missing or of the wrong kind; `field` is its dotted path, array items from 1. */
  | { readonly kind: 'invalid-field'; readonly field: string }
  | { readonly kind: 'row-count'; readonly rows: number; readonly expected: number }
  | {
      readonly kind: 'row-length'
      readonly row: number
      readonly length: number
      readonly expected: number
    }
  | {
      readonly kind: 'yarn-number'
      readonly row: number
      readonly yarn: number
      readonly paletteSize: number
    }

/** The error categories of a `.kchart` import; presentation turns them into toasts. */
export type KchartError =
  | { readonly code: 'not-kchart' }
  | { readonly code: 'newer-version' }
  | { readonly code: 'corrupt'; readonly detail: KchartCorruption }
  | { readonly code: 'too-large' }
  | { readonly code: 'too-many-yarns' }

export type KchartResult =
  { readonly ok: true; readonly chart: Chart } | { readonly ok: false; readonly error: KchartError }

/** A chart file to download: its default name and its text. */
export interface ChartFile {
  readonly name: string
  readonly text: string
}

/**
 * The `.kchart` format, as the presentation saves and opens chart files (spec, «Файл схемы .kchart»),
 * and as the autosave keeps the chart: the same document, as an object rather than text.
 */
export interface ChartFileFormat {
  write(chart: Chart): ChartFile
  read(text: string): KchartResult
  /** The chart as a document of the current version, a plain object. */
  toDocument(chart: Chart): object
  /** Imports a parsed document: format, version, migrations and checks, as `read` after parsing. */
  readDocument(document: unknown): KchartResult
}
