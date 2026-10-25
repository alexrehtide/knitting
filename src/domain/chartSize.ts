/** Largest chart width or height, in cells. */
export const MAX_CHART_SIDE = 500

/** Whether `n` can be a chart width or height: a whole number from 1 to {@link MAX_CHART_SIDE}. */
export function isValidChartSide(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_CHART_SIDE
}
