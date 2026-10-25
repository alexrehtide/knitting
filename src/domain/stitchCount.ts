import type { YarnId } from './palette'
import type { CellChange } from './patch'

/** Yarn id → how many cells hold it; empty cells and yarns with no stitches are left out. */
export type StitchCounts = Map<YarnId, number>

export function countStitches(cells: Uint16Array): StitchCounts {
  const counts: StitchCounts = new Map()
  for (const id of cells) if (id !== 0) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}

/** Moves each changed cell from its yarn before to its yarn after, in place. */
export function updateStitchCounts(counts: StitchCounts, changes: readonly CellChange[]): void {
  for (const { before, after } of changes) {
    if (before !== 0) {
      const left = (counts.get(before) ?? 0) - 1
      if (left > 0) counts.set(before, left)
      else counts.delete(before)
    }
    if (after !== 0) counts.set(after, (counts.get(after) ?? 0) + 1)
  }
}
