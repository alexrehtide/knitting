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

/** Draws the session's chart; the adapter subscribes to the session itself. */
export interface ChartRenderer {
  setSize(size: ViewSize): void
  setViewport(viewport: Viewport): void
  dispose(): void
}
