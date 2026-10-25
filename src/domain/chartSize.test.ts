import { describe, expect, it } from 'vitest'
import { MAX_CHART_SIDE, isValidChartSide } from './chartSize'

describe('isValidChartSide', () => {
  it('accepts whole numbers from 1 to the maximum', () => {
    expect(isValidChartSide(1)).toBe(true)
    expect(isValidChartSide(40)).toBe(true)
    expect(isValidChartSide(MAX_CHART_SIDE)).toBe(true)
  })

  it('rejects zero, values above the maximum and fractions', () => {
    expect(isValidChartSide(0)).toBe(false)
    expect(isValidChartSide(MAX_CHART_SIDE + 1)).toBe(false)
    expect(isValidChartSide(2.5)).toBe(false)
    expect(isValidChartSide(Number.NaN)).toBe(false)
  })
})
