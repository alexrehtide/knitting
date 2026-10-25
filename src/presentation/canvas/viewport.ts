import type { Viewport, ViewSize } from '../../application/chartRenderer'
import type { Chart } from '../../domain/chart'
import type { GridCell } from '../../domain/numbering'

type ChartSize = Pick<Chart, 'width' | 'height'>

/** Cell size shown as 100 %: the same 20 px as the PNG export. */
export const FULL_SIZE_CELL = 20
const MAX_CELL = 160
const FIT_MARGIN = 16
/** How much of the chart stays on screen however far it is scrolled. */
const KEEP_VISIBLE = 48
const ZOOM_FACTOR = 1.25

export function zoomPercent(viewport: Viewport): number {
  return Math.round((viewport.cellSize / FULL_SIZE_CELL) * 100)
}

/** The cell under a point of the canvas, in CSS px from its top left corner; `null` outside the grid. */
export function cellAt(
  viewport: Viewport,
  chart: ChartSize,
  x: number,
  y: number,
): GridCell | null {
  const column = Math.floor((x - viewport.originX) / viewport.cellSize)
  const row = Math.floor((y - viewport.originY) / viewport.cellSize)
  if (column < 0 || column >= chart.width || row < 0 || row >= chart.height) return null
  return { row, column }
}

/** The largest whole-device-px cell at which the whole chart fits, centred. */
export function fitViewport(chart: ChartSize, view: ViewSize): Viewport {
  const fits = Math.min(
    (view.width - 2 * FIT_MARGIN) / chart.width,
    (view.height - 2 * FIT_MARGIN) / chart.height,
  )
  const deviceCell = clampDeviceCell(Math.floor(fits * view.dpr), view.dpr)
  const cellSize = deviceCell / view.dpr
  return {
    cellSize,
    originX: snap((view.width - chart.width * cellSize) / 2, view.dpr),
    originY: snap((view.height - chart.height * cellSize) / 2, view.dpr),
  }
}

/** One zoom step in (`direction` 1) or out (-1), keeping the chart point under (`anchorX`, `anchorY`) still. */
export function zoomAt(
  viewport: Viewport,
  direction: 1 | -1,
  anchorX: number,
  anchorY: number,
  chart: ChartSize,
  view: ViewSize,
): Viewport {
  const current = Math.round(viewport.cellSize * view.dpr)
  const next = clampDeviceCell(
    direction > 0
      ? Math.max(current + 1, Math.round(current * ZOOM_FACTOR))
      : Math.min(current - 1, Math.round(current / ZOOM_FACTOR)),
    view.dpr,
  )
  const cellSize = next / view.dpr
  const scale = cellSize / viewport.cellSize
  return clampViewport(
    {
      cellSize,
      originX: snap(anchorX - (anchorX - viewport.originX) * scale, view.dpr),
      originY: snap(anchorY - (anchorY - viewport.originY) * scale, view.dpr),
    },
    chart,
    view,
  )
}

export function scrollBy(
  viewport: Viewport,
  dx: number,
  dy: number,
  chart: ChartSize,
  view: ViewSize,
): Viewport {
  return clampViewport(
    {
      ...viewport,
      originX: snap(viewport.originX - dx, view.dpr),
      originY: snap(viewport.originY - dy, view.dpr),
    },
    chart,
    view,
  )
}

function clampViewport(viewport: Viewport, chart: ChartSize, view: ViewSize): Viewport {
  const clampOrigin = (origin: number, chartPx: number, viewPx: number) => {
    const keep = Math.min(KEEP_VISIBLE, chartPx)
    return Math.min(Math.max(origin, keep - chartPx), viewPx - keep)
  }
  return {
    ...viewport,
    originX: snap(
      clampOrigin(viewport.originX, chart.width * viewport.cellSize, view.width),
      view.dpr,
    ),
    originY: snap(
      clampOrigin(viewport.originY, chart.height * viewport.cellSize, view.height),
      view.dpr,
    ),
  }
}

function clampDeviceCell(deviceCell: number, dpr: number): number {
  return Math.min(Math.max(deviceCell, 1), Math.round(MAX_CELL * dpr))
}

function snap(css: number, dpr: number): number {
  return Math.round(css * dpr) / dpr
}
