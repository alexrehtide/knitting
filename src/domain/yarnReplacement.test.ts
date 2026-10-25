import { describe, expect, it } from 'vitest'
import { createChart } from './chart'
import { addYarn, type Palette } from './palette'
import { applyPatch, invertPatch } from './patch'
import { selectionAfterRemoval, yarnReplacementPatch } from './yarnReplacement'

const now = new Date('2026-10-25T10:00:00.000Z')

/** A 3×2 chart with yarns 1, 2, 3 and cells `[2, 1, 2, 0, 3, 2]`. */
function chartWithThreeYarns() {
  const chart = createChart(3, 2, now)
  const added = addYarn(chart.palette, { color: '#ff0000' })
  if (!added.ok) throw new Error('rejected')
  chart.palette = added.palette
  chart.cells.set([2, 1, 2, 0, 3, 2])
  return chart
}

function ids(palette: Palette) {
  return palette.map((y) => y.id)
}

describe('yarnReplacementPatch', () => {
  it('puts the replacement in every cell of the yarn and keeps the yarn in the palette', () => {
    const chart = chartWithThreeYarns()

    applyPatch(chart, yarnReplacementPatch(chart, 2, 3, { remove: false }))

    expect([...chart.cells]).toEqual([3, 1, 3, 0, 3, 3])
    expect(ids(chart.palette)).toEqual([1, 2, 3])
  })

  it('empties the cells when the replacement is 0', () => {
    const chart = chartWithThreeYarns()

    applyPatch(chart, yarnReplacementPatch(chart, 2, 0, { remove: false }))

    expect([...chart.cells]).toEqual([0, 1, 0, 0, 3, 0])
  })

  it('with removal drops the yarn, and its inverse puts back the cells and the yarn in its place', () => {
    const chart = chartWithThreeYarns()
    const palette = chart.palette

    const patch = yarnReplacementPatch(chart, 2, 1, { remove: true })
    applyPatch(chart, patch)
    expect([...chart.cells]).toEqual([1, 1, 1, 0, 3, 1])
    expect(ids(chart.palette)).toEqual([1, 3])

    applyPatch(chart, invertPatch(patch))
    expect([...chart.cells]).toEqual([2, 1, 2, 0, 3, 2])
    expect(chart.palette).toEqual(palette)
  })
})

describe('selectionAfterRemoval', () => {
  const after = [1, 3].map((id) => ({ id, color: '#808080', pattern: null, name: '' }))

  it('gives the slot of the removed yarn the replacement', () => {
    expect(selectionAfterRemoval(after, { current: 2, previous: 1 }, 2, 3)).toEqual({
      current: 3,
      previous: 1,
    })
    expect(selectionAfterRemoval(after, { current: 1, previous: 2 }, 2, 3)).toEqual({
      current: 1,
      previous: 3,
    })
  })

  it('gives it the first yarn of the palette when the cells go empty', () => {
    expect(selectionAfterRemoval(after, { current: 3, previous: 2 }, 2, 0)).toEqual({
      current: 3,
      previous: 1,
    })
  })

  it('keeps the two slots apart when the replacement is the other selected yarn', () => {
    expect(selectionAfterRemoval(after, { current: 2, previous: 3 }, 2, 3)).toEqual({
      current: 3,
      previous: 1,
    })
  })

  it('leaves a selection without the removed yarn as it is', () => {
    expect(selectionAfterRemoval(after, { current: 3, previous: 1 }, 2, 3)).toEqual({
      current: 3,
      previous: 1,
    })
  })
})
