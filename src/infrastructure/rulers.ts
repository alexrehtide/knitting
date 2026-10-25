import type { Viewport } from '../application/chartRenderer'
import type { Chart } from '../domain/chart'
import { isMajorGridLine } from '../domain/gridLines'
import { numberOfCell } from '../domain/numbering'

const BACKGROUND = '#fafafa'
const BORDER_COLOR = '#d4d4d8'
const MINOR_TICK_COLOR = '#a1a1aa'
const MAJOR_TICK_COLOR = '#52525b'
const TEXT_COLOR = '#71717a'
const MAJOR_TEXT_COLOR = '#18181b'
const HOVER_COLOR = '#4f46e5'
const HOVER_TEXT_COLOR = '#ffffff'

/** In CSS px. */
const FONT_SIZE = 10
const LABEL_PADDING = 4
const TICK = 3
const MAJOR_TICK = 6
const TICKS_FROM = 4

/**
 * Ruler X (stitches) along the top or ruler Y (rows) along the left, aligned with the chart canvas:
 * a number in every cell if it fits, otherwise in every N-th (major step) or a multiple of it.
 * Major numbers are bold; the hovered one sits on an accent mark, even where numbers are skipped.
 */
export function drawRuler(
  ctx: CanvasRenderingContext2D,
  axis: 'x' | 'y',
  chart: Chart,
  viewport: Viewport,
  dpr: number,
  hovered: number | null,
) {
  const { canvas } = ctx
  const along = axis === 'x' ? canvas.width : canvas.height
  const across = axis === 'x' ? canvas.height : canvas.width
  const count = axis === 'x' ? chart.width : chart.height
  // The cell side along the ruler: its width on ruler X, its height on ruler Y.
  const cell = Math.round((axis === 'x' ? viewport.cellWidth : viewport.cellHeight) * dpr)
  const origin = Math.round((axis === 'x' ? viewport.originX : viewport.originY) * dpr)
  const { majorStep } = chart.properties
  const numberAt = (i: number) =>
    axis === 'x'
      ? numberOfCell(chart, { row: 0, column: i }).stitch
      : numberOfCell(chart, { row: i, column: 0 }).row

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // Draws in (along, across) coordinates; the chart side of the ruler is at `across`.
  const rect = (a: number, b: number, length: number, thickness: number) =>
    axis === 'x' ? ctx.rect(a, b, length, thickness) : ctx.rect(b, a, thickness, length)

  ctx.fillStyle = BORDER_COLOR
  ctx.beginPath()
  rect(0, across - 1, along, 1)
  ctx.fill()

  const i0 = Math.max(0, Math.floor(-origin / cell))
  const i1 = Math.min(count, Math.ceil((along - origin) / cell))
  if (i0 >= i1) return

  const font = (bold: boolean) =>
    `${bold ? 'bold ' : ''}${Math.round(FONT_SIZE * dpr)}px system-ui, sans-serif`
  ctx.font = font(true)
  const labelLength =
    (axis === 'x' ? ctx.measureText(String(count)).width : FONT_SIZE * dpr) + LABEL_PADDING * dpr
  const step = cell >= labelLength ? 1 : majorStep * Math.ceil(labelLength / (majorStep * cell))

  const isMajor = (boundary: number) =>
    isMajorGridLine(chart, axis === 'x' ? 'vertical' : 'horizontal', boundary)
  // Ticks stand at the chart side; numbers take the rest of the ruler's thickness.
  const tick = Math.round(TICK * dpr)
  const majorTick = Math.round(MAJOR_TICK * dpr)
  if (cell / dpr >= TICKS_FROM) {
    ctx.fillStyle = MINOR_TICK_COLOR
    ctx.beginPath()
    for (let b = i0; b <= i1; b++) if (!isMajor(b)) rect(origin + b * cell, across - tick, 1, tick)
    ctx.fill()
  }
  ctx.fillStyle = MAJOR_TICK_COLOR
  ctx.beginPath()
  for (let b = i0; b <= i1; b++)
    if (isMajor(b)) rect(origin + b * cell, across - majorTick, 1, majorTick)
  ctx.fill()

  const label = (i: number, color: string, bold: boolean) => {
    const n = numberAt(i)
    const centre = origin + i * cell + cell / 2
    ctx.font = font(bold)
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    if (axis === 'x') {
      ctx.textAlign = 'center'
      ctx.fillText(String(n), centre, (across - majorTick) / 2)
    } else {
      ctx.textAlign = 'right'
      ctx.fillText(String(n), across - majorTick - (LABEL_PADDING / 2) * dpr, centre)
    }
  }

  for (let i = i0; i < i1; i++) {
    const n = numberAt(i)
    if (i === hovered || n % step !== 0) continue
    const major = n % majorStep === 0
    label(i, major ? MAJOR_TEXT_COLOR : TEXT_COLOR, major)
  }

  if (hovered === null || hovered < 0 || hovered >= count) return
  const length = Math.max(cell, labelLength)
  ctx.fillStyle = HOVER_COLOR
  ctx.beginPath()
  rect(Math.round(origin + hovered * cell + (cell - length) / 2), 0, Math.round(length), across)
  ctx.fill()
  label(hovered, HOVER_TEXT_COLOR, true)
}
