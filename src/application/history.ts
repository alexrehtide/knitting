import type { ChartPatch } from '../domain/patch'

/** How many edits undo can reach back (docs/spec.md, «Undo / Redo»). */
export const HISTORY_DEPTH = 200

/** Undo and redo stacks of edits, each a patch that can be inverted (ADR-0001). */
export function createHistory() {
  const done: ChartPatch[] = []
  let undone: ChartPatch[] = []

  return {
    get canUndo() {
      return done.length > 0
    },
    get canRedo() {
      return undone.length > 0
    },
    /** Records a new edit; the oldest leaves past the depth, and the redo stack is dropped. */
    record(patch: ChartPatch) {
      done.push(patch)
      if (done.length > HISTORY_DEPTH) done.shift()
      undone = []
    },
    /** Replaces the last edit with one that also holds a change made on top of it. */
    amend(patch: ChartPatch) {
      if (done.length === 0) throw new Error('No edit to amend')
      done[done.length - 1] = patch
    },
    /** The edit to undo, moved to the redo stack. */
    undo(): ChartPatch | undefined {
      const patch = done.pop()
      if (patch) undone.push(patch)
      return patch
    },
    /** The edit to redo, moved back to the undo stack. */
    redo(): ChartPatch | undefined {
      const patch = undone.pop()
      if (patch) done.push(patch)
      return patch
    },
  }
}
