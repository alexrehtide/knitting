import { describe, expect, it } from 'vitest'
import {
  addYarn,
  parseYarnColor,
  removeYarn,
  updateYarn,
  yarnRemovalBlock,
  type Palette,
} from './palette'

const white = { color: '#ffffff' }

function yarn(id: number, pattern: Palette[number]['pattern'] = null) {
  return { id, color: '#808080', pattern, name: '' }
}

describe('addYarn', () => {
  it('gives the first yarn id 1 and the next one the following id', () => {
    const first = addYarn([], white)
    if (!first.ok) throw new Error('rejected')
    const second = addYarn(first.palette, white)
    if (!second.ok) throw new Error('rejected')

    expect(first.yarn.id).toBe(1)
    expect(second.yarn.id).toBe(2)
    expect(second.palette.map((y) => y.id)).toEqual([1, 2])
  })

  it('reuses the smallest id freed by a removed yarn and appends the yarn at the end', () => {
    const afterRemoval = [yarn(3), yarn(1), yarn(4)]

    const result = addYarn(afterRemoval, white)

    if (!result.ok) throw new Error('rejected')
    expect(result.yarn.id).toBe(2)
    expect(result.palette.map((y) => y.id)).toEqual([3, 1, 4, 2])
  })

  it('rejects the 65 536th yarn with «palette full»', () => {
    const full = Array.from({ length: 65_535 }, (_, i) => yarn(i + 1))

    expect(addYarn(full, white)).toEqual({ ok: false, code: 'palette-full' })
  })
})

describe('fill pattern of a new yarn', () => {
  function addMany(count: number): Palette {
    let palette: Palette = []
    for (let i = 0; i < count; i++) {
      const result = addYarn(palette, white)
      if (!result.ok) throw new Error('rejected')
      palette = result.palette
    }
    return palette
  }

  it('is the first pattern no yarn uses yet, in assignment order', () => {
    expect(addMany(3).map((y) => y.pattern)).toEqual(['cross', 'circle-filled', 'circle-outline'])

    const result = addYarn([yarn(1, 'circle-filled'), yarn(2, null)], white)
    if (!result.ok) throw new Error('rejected')
    expect(result.yarn.pattern).toBe('cross')
  })

  it('is the first of the least used patterns once all 16 are taken', () => {
    const palette = addMany(16)
    expect(palette.at(-1)?.pattern).toBe('asterisk')

    const seventeenth = addYarn(palette, white)
    if (!seventeenth.ok) throw new Error('rejected')
    expect(seventeenth.yarn.pattern).toBe('cross')

    const crossTwice = addYarn(
      palette.map((y) => (y.pattern === 'circle-filled' ? { ...y, pattern: 'cross' as const } : y)),
      white,
    )
    if (!crossTwice.ok) throw new Error('rejected')
    expect(crossTwice.yarn.pattern).toBe('circle-filled')
  })
})

describe('removeYarn', () => {
  it('drops the yarn and keeps the order of the rest', () => {
    expect(removeYarn([yarn(1), yarn(2), yarn(3)], 2).map((y) => y.id)).toEqual([1, 3])
  })
})

describe('yarnRemovalBlock', () => {
  it('blocks the last yarn and a yarn with stitches, and lets an unused one go', () => {
    expect(yarnRemovalBlock([yarn(1)], 0)).toBe('last-yarn')
    expect(yarnRemovalBlock([yarn(1), yarn(2)], 3)).toBe('yarn-in-use')
    expect(yarnRemovalBlock([yarn(1), yarn(2)], 0)).toBeNull()
  })
})

describe('updateYarn', () => {
  it('changes the colour and the name of one yarn, keeping its place', () => {
    const palette = [yarn(1), yarn(2)]

    const updated = updateYarn(palette, 2, { color: '#123456', name: 'Alize 55' })

    expect(updated).toEqual([yarn(1), { ...yarn(2), color: '#123456', name: 'Alize 55' }])
    expect(palette[1]?.color).toBe('#808080')
  })
})

describe('parseYarnColor', () => {
  it('reads #rrggbb and #rgb in any case, with or without #, as lower-case #rrggbb', () => {
    expect(parseYarnColor('#A1b2C3')).toBe('#a1b2c3')
    expect(parseYarnColor(' a1b2c3 ')).toBe('#a1b2c3')
    expect(parseYarnColor('#fA0')).toBe('#ffaa00')
  })

  it('rejects anything else', () => {
    for (const text of ['', '#12345', '#1234567', 'red', '#ggg000'])
      expect(parseYarnColor(text)).toBeNull()
  })
})
