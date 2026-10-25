import { describe, expect, it } from 'vitest'
import { MAX_CHART_DIMENSION, isValidChartDimension } from './chartSize'

describe('isValidChartDimension', () => {
  it('accepts whole numbers from 1 to the maximum', () => {
    expect(isValidChartDimension(1)).toBe(true)
    expect(isValidChartDimension(40)).toBe(true)
    expect(isValidChartDimension(MAX_CHART_DIMENSION)).toBe(true)
  })

  it('rejects zero, values above the maximum and fractions', () => {
    expect(isValidChartDimension(0)).toBe(false)
    expect(isValidChartDimension(MAX_CHART_DIMENSION + 1)).toBe(false)
    expect(isValidChartDimension(2.5)).toBe(false)
    expect(isValidChartDimension(Number.NaN)).toBe(false)
  })
})
