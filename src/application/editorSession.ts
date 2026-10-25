import { createChart, initialYarnSelection, repairYarnSelection, type Chart } from '../domain/chart'
import type { Clock } from '../domain/clock'
import { fillCells } from '../domain/fill'
import { lineCells, snapLineEnd } from '../domain/line'
import type { GridCell } from '../domain/numbering'
import {
  addYarn,
  parseYarnColor,
  removeYarn,
  updateYarn,
  yarnRemovalBlock,
  type Palette,
  type YarnChanges,
  type YarnId,
} from '../domain/palette'
import {
  applyPatch,
  invertPatch,
  type CellChange,
  type ChartPatch,
  type PlainPatch,
} from '../domain/patch'
import { clampToGrid, rectangleCells } from '../domain/rectangle'
import { countStitches, updateStitchCounts, type StitchCounts } from '../domain/stitchCount'
import { selectionAfterRemoval, yarnReplacementPatch } from '../domain/yarnReplacement'
import { createHistory } from './history'

/** Size of the chart the editor starts with when there is nothing to restore. */
export const START_CHART_SIZE = 40

/** Colour of a yarn added by «Добавить нить»; the user sets the real one in the yarn editor. */
export const NEW_YARN_COLOR = '#808080'

export const TOOLS = ['brush', 'eraser', 'fill', 'eyedropper', 'line', 'rectangle'] as const

export type Tool = (typeof TOOLS)[number]

/** «цвет», «узор», «цвет+узор», in the order `Tab` goes through them. */
export const DISPLAY_MODES = ['color', 'pattern', 'color-pattern'] as const

export type DisplayMode = (typeof DISPLAY_MODES)[number]

export function nextDisplayMode(mode: DisplayMode): DisplayMode {
  return DISPLAY_MODES[(DISPLAY_MODES.indexOf(mode) + 1) % DISPLAY_MODES.length] ?? 'color'
}

/** What a line or rectangle gesture paints on release; the overlay shows it during the gesture. */
export interface GesturePreview {
  readonly yarn: YarnId
  /** Cell indices, each once. */
  readonly cells: readonly number[]
  /** For the status bar: «длина 14», «12 × 5». */
  readonly size:
    | { readonly kind: 'line'; readonly length: number }
    | { readonly kind: 'rectangle'; readonly width: number; readonly height: number }
}

/** `primary` draws with the current yarn, `secondary` with the previous one. */
export type PointerButton = 'primary' | 'secondary'

/** An edit the session refused, as a typed code for the presentation's message. */
export type EditRejection = 'palette-full'

export interface EditorState {
  readonly chart: Chart
  readonly currentYarn: YarnId
  readonly previousYarn: YarnId
  /** The tool picked in the tool column or by its key. */
  readonly tool: Tool
  /** The tool a gesture starts with now: the eyedropper while it is held (`Alt`), otherwise `tool`. */
  readonly activeTool: Tool
  /** How the canvas shows the cells; a view preference, not an edit. */
  readonly displayMode: DisplayMode
  /** A gesture started on the grid and has not ended yet. */
  readonly gestureActive: boolean
  /** The preview of the line or rectangle gesture under way, otherwise `null`. */
  readonly preview: GesturePreview | null
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** The chart has what the last saved `.kchart` has not (docs/spec.md, «Изменения не в файле»). */
  readonly unsavedToFile: boolean
  /** Stitches of each yarn, kept up to date in place as patches change cells. */
  readonly stitchCounts: ReadonlyMap<YarnId, number>
}

/**
 * One stream for every subscriber (ADR-0006):
 * `patch` — a patch was applied to the chart (a gesture's cells, its rollback, a palette edit, undo, redo);
 * a composite patch comes as one event per part;
 * `preview` — the gesture preview changed, the chart did not;
 * `replaced` — the whole chart was replaced (new chart, opened file);
 * `state` — something else in the state changed (tool, display mode, yarn selection, gesture, history),
 * the chart did not;
 * `rejected` — an edit was refused, nothing changed.
 */
export type EditorEvent =
  | { readonly type: 'patch'; readonly patch: PlainPatch }
  | { readonly type: 'preview' }
  | { readonly type: 'replaced' }
  | { readonly type: 'state' }
  | { readonly type: 'rejected'; readonly code: EditRejection }

/**
 * Pointer commands come in cells, which may lie off the grid (docs/spec.md, «Инструменты»).
 * `pointer-up` also ends a gesture on `pointercancel` and on losing window focus: the gesture is kept.
 * Shift is read live from `pointer-move`; the `shift` of `pointer-up`, when given, is what a rectangle
 * is filled by, otherwise the last one counts.
 * `cancel-gesture` (`Esc`) rolls it back; so does a second `pointer-down` during it (a second button).
 * Yarn and palette commands are ignored during a gesture.
 * `update-yarn` with a `merge` key joins the last edit if it was made with the same key, so a colour
 * picker drag is one edit.
 * `replace-yarn` puts `replacement` (0 — empty) in every cell of the yarn; `remove-yarn` with a
 * `replacement` does that and removes the yarn as one edit, and a used yarn is removed only so.
 * `mark-saved` — the chart as it is now went to a `.kchart` file; `replace-chart` counts as saved too,
 * unless `unsavedToFile` says the chart has changes not in a file (one restored from the autosave):
 * then only saving clears the mark, as there is no history to undo back to a saved chart.
 */
export type EditorCommand =
  | { readonly type: 'replace-chart'; readonly chart: Chart; readonly unsavedToFile?: boolean }
  | { readonly type: 'select-tool'; readonly tool: Tool }
  | { readonly type: 'select-display-mode'; readonly mode: DisplayMode }
  | { readonly type: 'hold-eyedropper'; readonly held: boolean }
  | {
      readonly type: 'pointer-down'
      readonly cell: GridCell
      readonly button: PointerButton
      readonly shift: boolean
    }
  | { readonly type: 'pointer-move'; readonly cell: GridCell; readonly shift: boolean }
  | { readonly type: 'pointer-up'; readonly shift?: boolean }
  | { readonly type: 'cancel-gesture' }
  | { readonly type: 'select-yarn'; readonly yarn: YarnId }
  | { readonly type: 'swap-yarns' }
  | { readonly type: 'add-yarn' }
  | {
      readonly type: 'update-yarn'
      readonly yarn: YarnId
      readonly changes: YarnChanges
      readonly merge?: string
    }
  | { readonly type: 'replace-yarn'; readonly yarn: YarnId; readonly replacement: YarnId }
  | { readonly type: 'remove-yarn'; readonly yarn: YarnId; readonly replacement?: YarnId }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'mark-saved' }

export type EditorListener = (event: EditorEvent) => void

export interface EditorSession {
  readonly state: EditorState
  dispatch(command: EditorCommand): void
  /** Returns the function that unsubscribes the listener. */
  subscribe(listener: EditorListener): () => void
}

/** A brush or eraser gesture («мазок»): it changes cells at once and remembers what they held before. */
interface Stroke {
  readonly kind: 'stroke'
  readonly yarn: YarnId
  last: GridCell
  /** Cell index → yarn before the stroke, for the cells it changed. */
  readonly before: Map<number, YarnId>
}

/** A fill gesture: it fills on the press, the pointer moving during it changes nothing more. */
interface Fill {
  readonly kind: 'fill'
  readonly yarn: YarnId
  /** Cell index → yarn before the fill, for the cells it changed. */
  readonly before: Map<number, YarnId>
}

/** A line or rectangle gesture: it changes no cells until released, the preview shows what it will paint. */
interface Shape {
  readonly kind: 'shape'
  readonly tool: 'line' | 'rectangle'
  readonly yarn: YarnId
  readonly from: GridCell
  /** The pointer cell, which may lie off the grid. */
  to: GridCell
  /** Snaps a line to 0° / 45° / 90°, fills a rectangle. */
  shift: boolean
}

/** An eyedropper gesture: it takes the yarn under the pointer live, counted from the selection it started with. */
interface Pick {
  readonly kind: 'pick'
  readonly button: PointerButton
  readonly start: { readonly current: YarnId; readonly previous: YarnId }
}

// Only these reach a gesture; tool, display mode, yarn, palette and history commands are ignored during it.
const DURING_GESTURE = new Set<EditorCommand['type']>([
  'replace-chart',
  'hold-eyedropper',
  'pointer-down',
  'pointer-move',
  'pointer-up',
  'cancel-gesture',
])

export function createEditorSession({ clock }: { clock: Clock }): EditorSession {
  let history = createHistory()
  /** The history top when the chart was last saved to a file; the chart is unsaved when the top differs. */
  let savedTop = history.top
  let gesture: Stroke | Fill | Shape | Pick | null = null
  let eyedropperHeld = false
  /** The tool the eyedropper hands back after a click. */
  let toolBeforeEyedropper: Tool = 'brush'
  /** The last edit, while later `update-yarn` commands with its key may still join it. */
  let mergeable: { readonly key: string; readonly before: Palette } | null = null
  let stitchCounts: StitchCounts = new Map()
  let state = withChart(
    createChart(START_CHART_SIZE, START_CHART_SIZE, clock.now()),
    'brush',
    'color',
  )
  const listeners = new Set<EditorListener>()

  function emit(event: EditorEvent) {
    for (const listener of [...listeners]) listener(event)
  }

  function update(changes: Partial<EditorState>) {
    const tool = changes.tool ?? state.tool
    state = {
      ...state,
      activeTool: eyedropperHeld ? 'eyedropper' : tool,
      gestureActive: gesture !== null,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      unsavedToFile: history.top !== savedTop,
      ...changes,
    }
  }

  function withChart(chart: Chart, tool: Tool, displayMode: DisplayMode): EditorState {
    const { current, previous } = initialYarnSelection(chart.palette)
    stitchCounts = countStitches(chart.cells)
    return {
      chart,
      currentYarn: current,
      previousYarn: previous,
      tool,
      activeTool: eyedropperHeld ? 'eyedropper' : tool,
      displayMode,
      gestureActive: false,
      preview: null,
      canUndo: false,
      canRedo: false,
      unsavedToFile: history.top !== savedTop,
      stitchCounts,
    }
  }

  function apply(patch: ChartPatch) {
    if (patch.kind === 'composite') {
      for (const part of patch.parts) apply(part)
      return
    }
    if (patch.kind === 'cells' && patch.cells.length === 0) return
    const { chart } = state
    applyPatch(chart, patch)
    if (patch.kind === 'cells') updateStitchCounts(stitchCounts, patch.cells)
    const selection = repairYarnSelection(chart.palette, {
      current: state.currentYarn,
      previous: state.previousYarn,
    })
    update({ currentYarn: selection.current, previousYarn: selection.previous })
    emit({ type: 'patch', patch })
  }

  function record(patch: ChartPatch) {
    history.record(patch)
    mergeable = null
  }

  /** Applies a palette edit and records it, joining the last edit when `merge` names it. */
  function editPalette(after: Palette, merge?: string) {
    const before = state.chart.palette
    if (merge !== undefined && mergeable?.key === merge) {
      history.amend({ kind: 'palette', before: mergeable.before, after })
    } else {
      record({ kind: 'palette', before, after })
      if (merge !== undefined) mergeable = { key: merge, before }
    }
    apply({ kind: 'palette', before, after })
  }

  /** Whether `replacement` may stand in for the yarn: empty, or another yarn of the palette. */
  function canReplace(yarn: YarnId, replacement: YarnId) {
    const { palette } = state.chart
    return (
      replacement !== yarn &&
      palette.some((y) => y.id === yarn) &&
      (replacement === 0 || palette.some((y) => y.id === replacement))
    )
  }

  function select(current: YarnId, previous: YarnId) {
    if (current === state.currentYarn && previous === state.previousYarn) return
    update({ currentYarn: current, previousYarn: previous })
    emit({ type: 'state' })
  }

  function onGrid(cell: GridCell) {
    const { chart } = state
    return cell.row >= 0 && cell.row < chart.height && cell.column >= 0 && cell.column < chart.width
  }

  function paint(stroke: Stroke, from: GridCell, to: GridCell) {
    const { chart } = state
    const changes: CellChange[] = []
    for (const { row, column } of lineCells(from, to, chart)) {
      const index = row * chart.width + column
      const before = chart.cells[index] ?? 0
      if (before === stroke.yarn) continue
      if (!stroke.before.has(index)) stroke.before.set(index, before)
      changes.push({ index, before, after: stroke.yarn })
    }
    apply({ kind: 'cells', cells: changes })
  }

  /** Fills the area under the cell; filling an area with its own yarn changes nothing. */
  function fill(gesture: Fill, cell: GridCell) {
    const { chart } = state
    const before = chart.cells[cell.row * chart.width + cell.column] ?? 0
    if (before === gesture.yarn) return
    const changes = fillCells(cell, chart).map((index) => ({ index, before, after: gesture.yarn }))
    for (const { index } of changes) gesture.before.set(index, before)
    apply({ kind: 'cells', cells: changes })
  }

  /** The cells a line or rectangle gesture paints: the line clipped to the grid, the rectangle up to its edge. */
  function shapePreview({ tool, yarn, from, to, shift }: Shape): GesturePreview {
    const { chart } = state
    if (tool === 'line') {
      const end = shift ? snapLineEnd(from, to) : to
      const cells = lineCells(from, end, chart).map(({ row, column }) => row * chart.width + column)
      return { yarn, cells, size: { kind: 'line', length: cells.length } }
    }
    const corner = clampToGrid(to, chart)
    return {
      yarn,
      cells: rectangleCells(from, corner, chart, shift),
      size: {
        kind: 'rectangle',
        width: Math.abs(corner.column - from.column) + 1,
        height: Math.abs(corner.row - from.row) + 1,
      },
    }
  }

  function reshape(shape: Shape, to: GridCell, shift: boolean) {
    if (to.row === shape.to.row && to.column === shape.to.column && shift === shape.shift) return
    shape.to = to
    shape.shift = shift
    update({ preview: shapePreview(shape) })
    emit({ type: 'preview' })
  }

  /** Paints a line or a rectangle as one edit; cells that already hold its yarn are left out. */
  function paintShape(shape: Shape) {
    const { chart } = state
    const { yarn, cells } = shapePreview(shape)
    const changes: CellChange[] = []
    for (const index of cells) {
      const before = chart.cells[index] ?? 0
      if (before !== yarn) changes.push({ index, before, after: yarn })
    }
    if (changes.length === 0) return
    apply({ kind: 'cells', cells: changes })
    record({ kind: 'cells', cells: changes })
  }

  /** Takes the yarn of the cell; an empty cell or one off the grid leaves the selection as it is. */
  function pick({ button, start }: Pick, cell: GridCell) {
    const { chart } = state
    const yarn = onGrid(cell) ? (chart.cells[cell.row * chart.width + cell.column] ?? 0) : 0
    if (yarn === 0) return
    if (button === 'secondary') select(start.current, yarn)
    else if (yarn === start.current) select(start.current, start.previous)
    else select(yarn, start.current)
  }

  function startGesture(cell: GridCell, button: PointerButton, shift: boolean) {
    if (!onGrid(cell)) return
    const tool = state.activeTool
    if (tool === 'eyedropper') {
      const started: Pick = {
        kind: 'pick',
        button,
        start: { current: state.currentYarn, previous: state.previousYarn },
      }
      gesture = started
      update({})
      emit({ type: 'state' })
      pick(started, cell)
      return
    }
    const yarn =
      tool === 'eraser' ? 0 : button === 'primary' ? state.currentYarn : state.previousYarn
    if (tool === 'line' || tool === 'rectangle') {
      const started: Shape = { kind: 'shape', tool, yarn, from: cell, to: cell, shift }
      gesture = started
      update({ preview: shapePreview(started) })
      emit({ type: 'state' })
      emit({ type: 'preview' })
      return
    }
    const started: Stroke | Fill =
      tool === 'fill'
        ? { kind: 'fill', yarn, before: new Map() }
        : { kind: 'stroke', yarn, last: cell, before: new Map() }
    gesture = started
    update({})
    emit({ type: 'state' })
    if (started.kind === 'fill') fill(started, cell)
    else paint(started, cell, cell)
  }

  /**
   * Ends the gesture: `keep` records a stroke's or a fill's patch as one edit and paints a shape,
   * otherwise the gesture is rolled back.
   */
  function endGesture(keep: boolean) {
    if (!gesture) return
    const ended = gesture
    gesture = null
    if (ended.kind === 'shape') {
      if (keep) paintShape(ended)
      update({ preview: null })
      emit({ type: 'preview' })
      emit({ type: 'state' })
      return
    }
    if (ended.kind === 'pick') {
      if (!keep) select(ended.start.current, ended.start.previous)
      // After a click the eyedropper picked as a tool hands back the tool it was picked from.
      const tool = keep && state.tool === 'eyedropper' ? toolBeforeEyedropper : state.tool
      update({ tool })
      emit({ type: 'state' })
      return
    }
    const { yarn, before } = ended
    const patch: ChartPatch = {
      kind: 'cells',
      cells: [...before].map(([index, was]) => ({ index, before: was, after: yarn })),
    }
    // A gesture that changed nothing makes no edit.
    if (!keep) apply(invertPatch(patch))
    else if (patch.cells.length > 0) record(patch)
    update({})
    emit({ type: 'state' })
  }

  function run(command: EditorCommand) {
    switch (command.type) {
      case 'replace-chart':
        gesture = null
        mergeable = null
        history = createHistory()
        // A point that is never the history top.
        savedTop = command.unsavedToFile ? {} : history.top
        state = withChart(command.chart, state.tool, state.displayMode)
        emit({ type: 'replaced' })
        break
      case 'select-tool':
        if (command.tool === state.tool) break
        if (command.tool === 'eyedropper') toolBeforeEyedropper = state.tool
        update({ tool: command.tool })
        emit({ type: 'state' })
        break
      case 'select-display-mode':
        if (command.mode === state.displayMode) break
        update({ displayMode: command.mode })
        emit({ type: 'state' })
        break
      case 'hold-eyedropper':
        // Holding is ignored during a gesture; releasing is not, the gesture keeps its own tool.
        if (command.held === eyedropperHeld || (command.held && gesture)) break
        eyedropperHeld = command.held
        update({})
        emit({ type: 'state' })
        break
      case 'pointer-down':
        // A second button during the gesture cancels it.
        if (gesture) endGesture(false)
        else startGesture(command.cell, command.button, command.shift)
        break
      case 'pointer-move':
        if (gesture?.kind === 'pick') pick(gesture, command.cell)
        else if (gesture?.kind === 'stroke') {
          paint(gesture, gesture.last, command.cell)
          gesture.last = command.cell
        } else if (gesture?.kind === 'shape') reshape(gesture, command.cell, command.shift)
        break
      case 'pointer-up':
        if (
          gesture?.kind === 'shape' &&
          gesture.tool === 'rectangle' &&
          command.shift !== undefined
        )
          gesture.shift = command.shift
        endGesture(true)
        break
      case 'cancel-gesture':
        endGesture(false)
        break
      case 'select-yarn': {
        const { yarn } = command
        if (yarn === state.currentYarn || !state.chart.palette.some((y) => y.id === yarn)) break
        select(yarn, state.currentYarn)
        break
      }
      case 'swap-yarns':
        select(state.previousYarn, state.currentYarn)
        break
      case 'add-yarn': {
        const result = addYarn(state.chart.palette, { color: NEW_YARN_COLOR })
        if (result.ok) editPalette(result.palette)
        else emit({ type: 'rejected', code: result.code })
        break
      }
      case 'update-yarn': {
        const { yarn, changes, merge } = command
        const old = state.chart.palette.find((y) => y.id === yarn)
        const color = changes.color === undefined ? old?.color : parseYarnColor(changes.color)
        const name = changes.name ?? old?.name
        if (!old || !color || name === undefined) break
        const pattern = changes.pattern === undefined ? old.pattern : changes.pattern
        if (color === old.color && pattern === old.pattern && name === old.name) break
        editPalette(updateYarn(state.chart.palette, yarn, { color, pattern, name }), merge)
        break
      }
      case 'replace-yarn': {
        const { yarn, replacement } = command
        if (!canReplace(yarn, replacement) || !stitchCounts.has(yarn)) break
        const patch = yarnReplacementPatch(state.chart, yarn, replacement, { remove: false })
        record(patch)
        apply(patch)
        break
      }
      case 'remove-yarn': {
        const { palette } = state.chart
        const { yarn, replacement } = command
        if (!palette.some((y) => y.id === yarn) || yarnRemovalBlock(palette) !== null) break
        if (replacement === undefined) {
          if (!stitchCounts.has(yarn)) editPalette(removeYarn(palette, yarn))
          break
        }
        if (!canReplace(yarn, replacement)) break
        const patch = yarnReplacementPatch(state.chart, yarn, replacement, { remove: true })
        const selection = selectionAfterRemoval(
          removeYarn(palette, yarn),
          { current: state.currentYarn, previous: state.previousYarn },
          yarn,
          replacement,
        )
        // The slots move to the replacement first, so the removal leaves them nothing to repair.
        update({ currentYarn: selection.current, previousYarn: selection.previous })
        record(patch)
        apply(patch)
        break
      }
      case 'undo': {
        const patch = history.undo()
        mergeable = null
        if (patch) apply(invertPatch(patch))
        break
      }
      case 'redo': {
        const patch = history.redo()
        mergeable = null
        if (patch) apply(patch)
        break
      }
      case 'mark-saved':
        // A colour drag after saving starts a new edit, so its undo comes back to the saved chart.
        mergeable = null
        if (savedTop === history.top) break
        savedTop = history.top
        update({})
        emit({ type: 'state' })
        break
    }
  }

  return {
    get state() {
      return state
    },
    dispatch(command) {
      if (gesture && !DURING_GESTURE.has(command.type)) return
      run(command)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
