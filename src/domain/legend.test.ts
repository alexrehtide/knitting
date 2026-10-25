import { describe, expect, it } from 'vitest'
import { legend } from './legend'
import type { Palette } from './palette'

const palette: Palette = [
  { id: 3, color: '#ffffff', pattern: 'cross', name: 'Белый' },
  { id: 1, color: '#ff0000', pattern: 'circle-filled', name: '' },
  { id: 2, color: '#000000', pattern: null, name: 'Чёрный' },
]

describe('legend', () => {
  it('lists the yarns in palette order with their numbers and stitch counts', () => {
    const counts = new Map([
      [1, 4],
      [2, 7],
      [3, 1],
    ])

    expect(legend(palette, counts)).toEqual([
      { number: 1, yarn: palette[0], stitches: 1 },
      { number: 2, yarn: palette[1], stitches: 4 },
      { number: 3, yarn: palette[2], stitches: 7 },
    ])
  })

  it('leaves out a yarn with no stitches and keeps the palette number of the next one', () => {
    const counts = new Map([
      [3, 5],
      [2, 2],
    ])

    expect(legend(palette, counts)).toEqual([
      { number: 1, yarn: palette[0], stitches: 5 },
      { number: 3, yarn: palette[2], stitches: 2 },
    ])
  })
})
