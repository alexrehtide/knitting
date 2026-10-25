import { createChart, initialYarnSelection, type Chart } from '../domain/chart'
import type { Clock } from '../domain/clock'
import type { YarnId } from '../domain/palette'
import type { ChartPatch } from '../domain/patch'

/** Size of the chart the editor starts with when there is nothing to restore. */
export const START_CHART_SIZE = 40

export interface EditorState {
  readonly chart: Chart
  readonly currentYarn: YarnId
  readonly previousYarn: YarnId
}

/**
 * One stream for every subscriber (ADR-0006):
 * `patch` — a patch was applied to the chart (edit, undo, redo);
 * `preview` — the gesture preview changed, the chart did not;
 * `replaced` — the whole chart was replaced (new chart, opened file).
 */
export type EditorEvent =
  | { readonly type: 'patch'; readonly patch: ChartPatch }
  | { readonly type: 'preview' }
  | { readonly type: 'replaced' }

export type EditorCommand = { readonly type: 'replace-chart'; readonly chart: Chart }

export type EditorListener = (event: EditorEvent) => void

export interface EditorSession {
  readonly state: EditorState
  dispatch(command: EditorCommand): void
  /** Returns the function that unsubscribes the listener. */
  subscribe(listener: EditorListener): () => void
}

export function createEditorSession({ clock }: { clock: Clock }): EditorSession {
  let state = withChart(createChart(START_CHART_SIZE, START_CHART_SIZE, clock.now()))
  const listeners = new Set<EditorListener>()

  function emit(event: EditorEvent) {
    for (const listener of [...listeners]) listener(event)
  }

  return {
    get state() {
      return state
    },
    dispatch(command) {
      switch (command.type) {
        case 'replace-chart':
          state = withChart(command.chart)
          emit({ type: 'replaced' })
          break
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function withChart(chart: Chart): EditorState {
  const { current, previous } = initialYarnSelection(chart.palette)
  return { chart, currentYarn: current, previousYarn: previous }
}
