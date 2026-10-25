import { describe, expect, it } from 'vitest'
import { countStitches, updateStitchCounts } from './stitchCount'

describe('countStitches', () => {
  it('counts the cells of each yarn and leaves empty cells out', () => {
    const counts = countStitches(Uint16Array.from([1, 0, 2, 1, 0, 1]))

    expect(counts).toEqual(
      new Map([
        [1, 3],
        [2, 1],
      ]),
    )
  })
})

describe('updateStitchCounts', () => {
  it('moves each changed cell from its yarn before to its yarn after', () => {
    const counts = countStitches(Uint16Array.from([1, 1, 0]))

    updateStitchCounts(counts, [
      { index: 0, before: 1, after: 2 },
      { index: 2, before: 0, after: 2 },
    ])

    expect(counts.get(1)).toBe(1)
    expect(counts.get(2)).toBe(2)
    expect(counts.has(0)).toBe(false)
  })
})
