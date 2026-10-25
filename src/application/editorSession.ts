import { createChart, initialYarnSelection, type Chart } from '../domain/chart'
import type { Clock } from '../domain/clock'
import { lineCells } from '../domain/line'
import type { GridCell } from '../domain/numbering'
import type { YarnId } from '../domain/palette'
import { applyPatch, invertPatch, type CellChange, type ChartPatch } from '../domain/patch'
import { createHistory } from './history'

/** Size of the chart the editor starts with when there is nothing to restore. */
export const START_CHART_SIZE = 40

export type Tool = 'brush' | 'eraser'

/** `primary` draws with the current yarn, `secondary` with the previous one. */
export type PointerButton = 'primary' | 'secondary'

export interface EditorState {
  readonly chart: Chart
  readonly currentYarn: YarnId
  readonly previousYarn: YarnId
  readonly tool: Tool
  /** A gesture started on the grid and has not ended yet. */
  readonly gestureActive: boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
}

/**
 * One stream for every subscriber (ADR-0006):
 * `patch` — a patch was applied to the chart (a gesture's cells, its rollback, undo, redo);
 * `preview` — the gesture preview changed, the chart did not;
 * `replaced` — the whole chart was replaced (new chart, opened file);
 * `state` — something else in the state changed (tool, gesture, history), the chart did not.
 */
export type EditorEvent =
  | { readonly type: 'patch'; readonly patch: ChartPatch }
  | { readonly type: 'preview' }
  | { readonly type: 'replaced' }
  | { readonly type: 'state' }

/**
 * Pointer commands come in cells, which may lie off the grid (docs/spec.md, «Инструменты»).
 * `pointer-up` also ends a gesture on `pointercancel` and on losing window focus: the gesture is kept.
 * `cancel-gesture` (`Esc`) rolls it back; so does a second `pointer-down` during it (a second button).
 */
export type EditorCommand =
  | { readonly type: 'replace-chart'; readonly chart: Chart }
  | { readonly type: 'select-tool'; readonly tool: Tool }
  | {
      readonly type: 'pointer-down'
      readonly cell: GridCell
      readonly button: PointerButton
      readonly shift: boolean
    }
  | { readonly type: 'pointer-move'; readonly cell: GridCell; readonly shift: boolean }
  | { readonly type: 'pointer-up' }
  | { readonly type: 'cancel-gesture' }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }

export type EditorListener = (event: EditorEvent) => void

export interface EditorSession {
  readonly state: EditorState
  dispatch(command: EditorCommand): void
  /** Returns the function that unsubscribes the listener. */
  subscribe(listener: EditorListener): () => void
}

/** A brush or eraser gesture («мазок»): it changes cells at once and remembers what they held before. */
interface Stroke {
  readonly yarn: YarnId
  last: GridCell
  /** Cell index → yarn before the stroke, for the cells it changed. */
  readonly before: Map<number, YarnId>
}

export function createEditorSession({ clock }: { clock: Clock }): EditorSession {
  let history = createHistory()
  let stroke: Stroke | null = null
  let state = withChart(createChart(START_CHART_SIZE, START_CHART_SIZE, clock.now()), 'brush')
  const listeners = new Set<EditorListener>()

  function emit(event: EditorEvent) {
    for (const listener of [...listeners]) listener(event)
  }

  function update(changes: Partial<EditorState>) {
    state = {
      ...state,
      gestureActive: stroke !== null,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      ...changes,
    }
  }

  function apply(cells: readonly CellChange[]) {
    if (cells.length === 0) return
    const patch: ChartPatch = { kind: 'cells', cells }
    applyPatch(state.chart, patch)
    update({})
    emit({ type: 'patch', patch })
  }

  function paint(from: GridCell, to: GridCell) {
    if (!stroke) return
    const { chart } = state
    const changes: CellChange[] = []
    for (const { row, column } of lineCells(from, to, chart)) {
      const index = row * chart.width + column
      const before = chart.cells[index] ?? 0
      if (before === stroke.yarn) continue
      if (!stroke.before.has(index)) stroke.before.set(index, before)
      changes.push({ index, before, after: stroke.yarn })
    }
    apply(changes)
  }

  function startGesture(cell: GridCell, button: PointerButton) {
    const { chart } = state
    if (cell.row < 0 || cell.row >= chart.height || cell.column < 0 || cell.column >= chart.width)
      return
    const yarn =
      state.tool === 'eraser' ? 0 : button === 'primary' ? state.currentYarn : state.previousYarn
    stroke = { yarn, last: cell, before: new Map() }
    update({})
    emit({ type: 'state' })
    paint(cell, cell)
  }

  /** Ends the gesture: `keep` records its patch as one edit, otherwise the patch is rolled back. */
  function endGesture(keep: boolean) {
    if (!stroke) return
    const { yarn, before } = stroke
    stroke = null
    const patch: ChartPatch = {
      kind: 'cells',
      cells: [...before].map(([index, was]) => ({ index, before: was, after: yarn })),
    }
    // A gesture that changed nothing makes no edit.
    if (!keep) apply(invertPatch(patch).cells)
    else if (patch.cells.length > 0) history.record(patch)
    update({})
    emit({ type: 'state' })
  }

  return {
    get state() {
      return state
    },
    dispatch(command) {
      switch (command.type) {
        case 'replace-chart':
          stroke = null
          history = createHistory()
          state = withChart(command.chart, state.tool)
          emit({ type: 'replaced' })
          break
        case 'select-tool':
          if (stroke || command.tool === state.tool) break
          update({ tool: command.tool })
          emit({ type: 'state' })
          break
        case 'pointer-down':
          // A second button during the gesture cancels it.
          if (stroke) endGesture(false)
          else startGesture(command.cell, command.button)
          break
        case 'pointer-move':
          if (!stroke) break
          paint(stroke.last, command.cell)
          stroke.last = command.cell
          break
        case 'pointer-up':
          endGesture(true)
          break
        case 'cancel-gesture':
          endGesture(false)
          break
        case 'undo': {
          const patch = stroke ? undefined : history.undo()
          if (patch) apply(invertPatch(patch).cells)
          break
        }
        case 'redo': {
          const patch = stroke ? undefined : history.redo()
          if (patch) apply(patch.cells)
          break
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function withChart(chart: Chart, tool: Tool): EditorState {
  const { current, previous } = initialYarnSelection(chart.palette)
  return {
    chart,
    currentYarn: current,
    previousYarn: previous,
    tool,
    gestureActive: false,
    canUndo: false,
    canRedo: false,
  }
}
