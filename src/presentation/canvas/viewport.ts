import type { Viewport, ViewSize } from '../../application/chartRenderer'
import type { Chart } from '../../domain/chart'
import type { GridCell } from '../../domain/numbering'

type ChartSize = Pick<Chart, 'width' | 'height'>

/** Cell width shown as 100 %: the same 20 px as the PNG export. */
export const FULL_SIZE_CELL = 20
/** The longer side of a cell at the closest zoom. */
const MAX_CELL = 160
const FIT_MARGIN = 16
/** How much of the chart stays on screen however far it is scrolled. */
const KEEP_VISIBLE = 48
const ZOOM_FACTOR = 1.25

export function zoomPercent(viewport: Viewport): number {
  return Math.round((viewport.cellWidth / FULL_SIZE_CELL) * 100)
}

/** The cell under a point of the canvas, in CSS px from its top left corner; `null` outside the grid. */
export function cellAt(
  viewport: Viewport,
  chart: ChartSize,
  x: number,
  y: number,
): GridCell | null {
  const { row, column } = unboundedCellAt(viewport, x, y)
  if (column < 0 || column >= chart.width || row < 0 || row >= chart.height) return null
  return { row, column }
}

/** The cell a canvas point falls in, extending the grid beyond its edges; a gesture is clipped later. */
export function unboundedCellAt(viewport: Viewport, x: number, y: number): GridCell {
  return {
    row: Math.floor((y - viewport.originY) / viewport.cellHeight),
    column: Math.floor((x - viewport.originX) / viewport.cellWidth),
  }
}

/** The largest whole-device-px cell of the aspect (width / height) at which the whole chart fits, centred. */
export function fitViewport(chart: ChartSize, view: ViewSize, aspect: number): Viewport {
  const width = view.width - 2 * FIT_MARGIN
  const height = view.height - 2 * FIT_MARGIN
  const fits = Math.min(width / chart.width, (height / chart.height) * aspect)
  let deviceWidth = clampDeviceWidth(Math.floor(fits * view.dpr), aspect, view.dpr)
  // The rounded height may overshoot by up to half a device px per row.
  while (deviceWidth > 1 && deviceHeight(deviceWidth, aspect) * chart.height > height * view.dpr)
    deviceWidth--
  const { cellWidth, cellHeight } = cellOf(deviceWidth, aspect, view.dpr)
  return {
    cellWidth,
    cellHeight,
    originX: snap((view.width - chart.width * cellWidth) / 2, view.dpr),
    originY: snap((view.height - chart.height * cellHeight) / 2, view.dpr),
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
  aspect: number,
): Viewport {
  const current = Math.round(viewport.cellWidth * view.dpr)
  const next = clampDeviceWidth(
    direction > 0
      ? Math.max(current + 1, Math.round(current * ZOOM_FACTOR))
      : Math.min(current - 1, Math.round(current / ZOOM_FACTOR)),
    aspect,
    view.dpr,
  )
  const { cellWidth, cellHeight } = cellOf(next, aspect, view.dpr)
  return clampViewport(
    {
      cellWidth,
      cellHeight,
      originX: snap(
        anchorX - (anchorX - viewport.originX) * (cellWidth / viewport.cellWidth),
        view.dpr,
      ),
      originY: snap(
        anchorY - (anchorY - viewport.originY) * (cellHeight / viewport.cellHeight),
        view.dpr,
      ),
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
      clampOrigin(viewport.originX, chart.width * viewport.cellWidth, view.width),
      view.dpr,
    ),
    originY: snap(
      clampOrigin(viewport.originY, chart.height * viewport.cellHeight, view.height),
      view.dpr,
    ),
  }
}

/** The cell height in device px for a width: never under 1. */
function deviceHeight(deviceWidth: number, aspect: number): number {
  return Math.max(1, Math.round(deviceWidth / aspect))
}

function cellOf(deviceWidth: number, aspect: number, dpr: number) {
  return { cellWidth: deviceWidth / dpr, cellHeight: deviceHeight(deviceWidth, aspect) / dpr }
}

/** At least 1 device px wide, and neither side longer than {@link MAX_CELL}. */
function clampDeviceWidth(deviceWidth: number, aspect: number, dpr: number): number {
  const max = Math.max(1, Math.round(MAX_CELL * dpr * Math.min(1, aspect)))
  return Math.min(Math.max(deviceWidth, 1), max)
}

function snap(css: number, dpr: number): number {
  return Math.round(css * dpr) / dpr
}
