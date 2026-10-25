/** Largest chart width or height, in cells. */
export const MAX_CHART_DIMENSION = 500

/** Whether `cells` can be a chart width or height: a whole number from 1 to {@link MAX_CHART_DIMENSION}. */
export function isValidChartDimension(cells: number): boolean {
  return Number.isInteger(cells) && cells >= 1 && cells <= MAX_CHART_DIMENSION
}
