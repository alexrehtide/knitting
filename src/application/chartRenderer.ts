import type { GridCell } from '../domain/numbering'

/** Chart placement on the canvas, in CSS px; `cellSize × dpr` is always a whole number of device px. */
export interface Viewport {
  readonly cellSize: number
  readonly originX: number
  readonly originY: number
}

/** Canvas size in CSS px and its device pixel ratio. */
export interface ViewSize {
  readonly width: number
  readonly height: number
  readonly dpr: number
}

/** The cell under the pointer, outlined and marked on the rulers and, with `lines`, as its row and column on the grid. */
export interface Hover {
  readonly cell: GridCell | null
  readonly lines: boolean
}

/** Draws the session's chart, its overlay and rulers; the adapter subscribes to the session itself. */
export interface ChartRenderer {
  setSize(size: ViewSize): void
  setViewport(viewport: Viewport): void
  setHover(hover: Hover): void
  dispose(): void
}
