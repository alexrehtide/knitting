import type { Chart } from './chart'

/**
 * Whether the grid line before cell `boundary` (0 to width or height) is bold.
 * The chart edges are always bold; inner lines count every N-th from where numbering starts,
 * so the bold lines fall next to the ruler numbers N, 2N, …
 */
export function isMajorGridLine(
  chart: Chart,
  axis: 'vertical' | 'horizontal',
  boundary: number,
): boolean {
  const { majorStep, numbering } = chart.properties
  const count = axis === 'vertical' ? chart.width : chart.height
  if (boundary === 0 || boundary === count) return true
  const fromFarEdge =
    axis === 'vertical' ? numbering.stitches === 'right-to-left' : numbering.rows === 'bottom-up'
  return (fromFarEdge ? count - boundary : boundary) % majorStep === 0
}
