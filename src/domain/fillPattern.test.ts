import { describe, expect, it } from 'vitest'
import { FILL_PATTERNS, PATTERN_SHAPES, patternInk, type PatternPrimitive } from './fillPattern'

/** The points a primitive reaches, its circles by their extreme points. */
function reach(primitive: PatternPrimitive): readonly (readonly [number, number])[] {
  switch (primitive.kind) {
    case 'segment':
      return [primitive.from, primitive.to]
    case 'disc':
    case 'circle': {
      const [x, y] = primitive.center
      const r = primitive.radius
      return [
        [x - r, y],
        [x + r, y],
        [x, y - r],
        [x, y + r],
      ]
    }
    case 'polygon':
    case 'polyline':
      return primitive.points
  }
}

describe('PATTERN_SHAPES', () => {
  it('describes each of the 16 patterns', () => {
    expect(FILL_PATTERNS).toHaveLength(16)
    for (const pattern of FILL_PATTERNS)
      expect(PATTERN_SHAPES[pattern].length, pattern).toBeGreaterThan(0)
  })

  it('keeps every point of every primitive inside the unit cell square', () => {
    for (const pattern of FILL_PATTERNS)
      for (const primitive of PATTERN_SHAPES[pattern])
        for (const [x, y] of reach(primitive)) {
          expect(x, pattern).toBeGreaterThanOrEqual(0)
          expect(x, pattern).toBeLessThanOrEqual(1)
          expect(y, pattern).toBeGreaterThanOrEqual(0)
          expect(y, pattern).toBeLessThanOrEqual(1)
        }
  })
})

describe('patternInk', () => {
  it('draws black over white and white over black', () => {
    expect(patternInk('#ffffff')).toBe('black')
    expect(patternInk('#000000')).toBe('white')
  })

  it('turns white below relative luminance 0.18', () => {
    // sRGB 0x75 ≈ 0.178, 0x76 ≈ 0.181 in linear light.
    expect(patternInk('#757575')).toBe('white')
    expect(patternInk('#767676')).toBe('black')
  })
})
