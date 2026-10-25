import type { Chart } from './chart'
import { removeYarn, type Palette, type YarnId } from './palette'
import type { CellChange, CellsPatch, ChartPatch } from './patch'

/** The patch that puts `replacement` (0 — empty, «нет петли») in every cell of the yarn. */
export function yarnReplacementPatch(chart: Chart, yarn: YarnId, replacement: YarnId): CellsPatch {
  const cells: CellChange[] = []
  chart.cells.forEach((id, index) => {
    if (id === yarn) cells.push({ index, before: yarn, after: replacement })
  })
  return { kind: 'cells', cells }
}

/**
 * The replacement of the yarn's cells and its removal from the palette as one edit, whose inverse
 * puts the yarn back in its place with its id.
 */
export function yarnRemovalPatch(chart: Chart, yarn: YarnId, replacement: YarnId): ChartPatch {
  return {
    kind: 'composite',
    parts: [
      yarnReplacementPatch(chart, yarn, replacement),
      { kind: 'palette', before: chart.palette, after: removeYarn(chart.palette, yarn) },
    ],
  }
}

/**
 * The selection after the yarn is removed with a replacement: its slot gets the replacement, or the
 * first yarn of `palette` (the palette after the removal) when the cells went empty. If that is the
 * yarn in the other slot, this slot takes another yarn, so the two stay apart while the palette allows.
 */
export function selectionAfterRemoval(
  palette: Palette,
  selection: { current: YarnId; previous: YarnId },
  removed: YarnId,
  replacement: YarnId,
): { current: YarnId; previous: YarnId } {
  const first = palette[0]
  if (first === undefined) throw new RangeError('A palette is never empty')
  const substitute = replacement !== 0 ? replacement : first.id
  const { current, previous } = selection
  if (current === removed) {
    const other = previous === substitute ? anotherYarn(palette, substitute) : previous
    return { current: substitute, previous: other }
  }
  if (previous === removed)
    return {
      current,
      previous: current === substitute ? anotherYarn(palette, substitute) : substitute,
    }
  return selection
}

function anotherYarn(palette: Palette, yarn: YarnId): YarnId {
  return palette.find((y) => y.id !== yarn)?.id ?? yarn
}
