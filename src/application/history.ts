import type { ChartPatch } from '../domain/patch'

/** How many edits undo can reach back (docs/spec.md, «Undo / Redo»). */
export const HISTORY_DEPTH = 200

/** A point in the history, compared by identity only. */
export type HistoryPoint = object

/** Undo and redo stacks of edits, each a patch that can be inverted (ADR-0001). */
export function createHistory() {
  const done: ChartPatch[] = []
  let undone: ChartPatch[] = []
  /** Stands for the chart below the oldest edit; a new one each time an edit leaves past the depth. */
  let base: HistoryPoint = {}

  return {
    get canUndo() {
      return done.length > 0
    },
    get canRedo() {
      return undone.length > 0
    },
    /**
     * The point the chart is at: the last edit, or the base when there is nothing to undo. The same
     * value means the same chart; an edit amended, dropped or pushed out never comes back as the top.
     */
    get top(): HistoryPoint {
      return done[done.length - 1] ?? base
    },
    /** Records a new edit; the oldest leaves past the depth, and the redo stack is dropped. */
    record(patch: ChartPatch) {
      done.push(patch)
      if (done.length > HISTORY_DEPTH) {
        done.shift()
        base = {}
      }
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
