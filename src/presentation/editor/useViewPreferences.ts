import { watch, type ShallowRef } from 'vue'
import {
  DISPLAY_MODES,
  TOOLS,
  type DisplayMode,
  type EditorSession,
  type EditorState,
  type Tool,
} from '../../application/editorSession'
import type { ChartView } from '../canvas/useChartView'

/** The `localStorage` key of the view preferences (docs/spec.md, «Автосохранение»). */
export const VIEW_PREFERENCES_KEY = 'knitting.view'

interface ViewPreferences {
  readonly displayMode: DisplayMode
  readonly lineHighlight: boolean
  readonly tool: Tool
}

/** What is stored and still makes sense; storage may be off, as in a private window. */
function load(): Partial<ViewPreferences> {
  let stored: unknown
  try {
    stored = JSON.parse(localStorage.getItem(VIEW_PREFERENCES_KEY) ?? '{}')
  } catch {
    return {}
  }
  if (typeof stored !== 'object' || stored === null) return {}
  const { displayMode, lineHighlight, tool } = stored as Record<string, unknown>
  return {
    ...(DISPLAY_MODES.some((m) => m === displayMode)
      ? { displayMode: displayMode as DisplayMode }
      : {}),
    ...(typeof lineHighlight === 'boolean' ? { lineHighlight } : {}),
    ...(TOOLS.some((t) => t === tool) ? { tool: tool as Tool } : {}),
  }
}

function save(preferences: ViewPreferences) {
  try {
    localStorage.setItem(VIEW_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // Not kept: the preferences are a convenience.
  }
}

/**
 * Brings back the display mode, the line highlight flag and the current tool, and keeps them as they change.
 * The yarn, zoom and scroll are not kept: a reload starts with the first yarn and a fitted view.
 */
export function useViewPreferences(
  view: ChartView,
  state: ShallowRef<EditorState>,
  dispatch: EditorSession['dispatch'],
) {
  const stored = load()
  if (stored.lineHighlight !== undefined) view.setLineHighlight(stored.lineHighlight)
  if (stored.tool !== undefined) dispatch({ type: 'select-tool', tool: stored.tool })
  if (stored.displayMode !== undefined)
    dispatch({ type: 'select-display-mode', mode: stored.displayMode })

  watch(
    [() => state.value.displayMode, view.lineHighlight, () => state.value.tool],
    ([displayMode, lineHighlight, tool]) => save({ displayMode, lineHighlight, tool }),
  )
}
