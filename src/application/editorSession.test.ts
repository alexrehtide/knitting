import { describe, expect, it } from 'vitest'
import { createChart } from '../domain/chart'
import type { Clock } from '../domain/clock'
import { lineCells } from '../domain/line'
import type { GridCell } from '../domain/numbering'
import {
  createEditorSession,
  DISPLAY_MODES,
  nextDisplayMode,
  type EditorEvent,
  type EditorSession,
  type PointerButton,
} from './editorSession'

const now = new Date('2026-10-25T10:00:00.000Z')
const clock: Clock = { now: () => now }

/** A session on a 10×8 chart, so cell (row, column) is at index `row * 10 + column`. */
function smallSession() {
  const session = createEditorSession({ clock })
  session.dispatch({ type: 'replace-chart', chart: createChart(10, 8, now) })
  return session
}

function cellAt(session: EditorSession, row: number, column: number) {
  return session.state.chart.cells[row * session.state.chart.width + column]
}

function painted(session: EditorSession) {
  const { cells, width } = session.state.chart
  const result: { row: number; column: number; yarn: number }[] = []
  cells.forEach((yarn, i) => {
    if (yarn !== 0) result.push({ row: Math.floor(i / width), column: i % width, yarn })
  })
  return result
}

/** Presses at the first point, drags through the rest and releases. */
function stroke(
  session: EditorSession,
  points: readonly GridCell[],
  button: PointerButton = 'primary',
) {
  const [first, ...rest] = points
  if (!first) throw new Error('A stroke needs a point')
  session.dispatch({ type: 'pointer-down', cell: first, button, shift: false })
  for (const cell of rest) session.dispatch({ type: 'pointer-move', cell, shift: false })
  session.dispatch({ type: 'pointer-up' })
}

describe('brush and eraser', () => {
  it('paints the current yarn with the primary button and the previous with the secondary', () => {
    const session = smallSession()

    stroke(session, [{ row: 1, column: 1 }])
    stroke(session, [{ row: 2, column: 2 }], 'secondary')

    expect(cellAt(session, 1, 1)).toBe(session.state.currentYarn)
    expect(cellAt(session, 2, 2)).toBe(session.state.previousYarn)
  })

  it('changes cells at once, while the button is still down', () => {
    const session = smallSession()
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 0 },
      button: 'primary',
      shift: false,
    })
    session.dispatch({ type: 'pointer-move', cell: { row: 0, column: 1 }, shift: false })

    expect(cellAt(session, 0, 1)).toBe(1)
    expect(events.filter((e) => e.type === 'patch')).toEqual([
      { type: 'patch', patch: { kind: 'cells', cells: [{ index: 0, before: 0, after: 1 }] } },
      { type: 'patch', patch: { kind: 'cells', cells: [{ index: 1, before: 0, after: 1 }] } },
    ])
  })

  it('fills the gap between pointer points 5 cells apart with an 8-connected chain', () => {
    const session = smallSession()

    stroke(session, [
      { row: 1, column: 0 },
      { row: 3, column: 5 },
    ])

    const cells = painted(session)
    expect(cells).toHaveLength(6)
    expect(new Set(cells.map((c) => c.column))).toEqual(new Set([0, 1, 2, 3, 4, 5]))
    cells.sort((a, b) => a.column - b.column)
    for (let i = 1; i < cells.length; i++)
      expect(Math.abs(cells[i]!.row - cells[i - 1]!.row)).toBeLessThanOrEqual(1)
  })

  it('clips the stroke to the grid when the pointer leaves it', () => {
    const session = smallSession()

    stroke(session, [
      { row: 0, column: 8 },
      { row: 0, column: 14 },
      { row: 3, column: 14 },
    ])

    expect(painted(session).map(({ row, column }) => ({ row, column }))).toEqual([
      { row: 0, column: 8 },
      { row: 0, column: 9 },
    ])
  })

  it('makes cells empty with the eraser, by either button', () => {
    const session = smallSession()
    stroke(session, [
      { row: 0, column: 0 },
      { row: 0, column: 3 },
    ])
    session.dispatch({ type: 'select-tool', tool: 'eraser' })

    stroke(session, [{ row: 0, column: 0 }])
    stroke(session, [{ row: 0, column: 1 }], 'secondary')

    expect(session.state.tool).toBe('eraser')
    expect(painted(session).map((c) => c.column)).toEqual([2, 3])
  })

  it('does nothing for a gesture started off the grid', () => {
    const session = smallSession()

    stroke(session, [
      { row: -1, column: 2 },
      { row: 2, column: 2 },
      { row: 3, column: 2 },
    ])

    expect(painted(session)).toEqual([])
    expect(session.state.canUndo).toBe(false)
  })
})

describe('fill', () => {
  /** A closed frame of yarn 2 around rows 1–3, columns 1–3, drawn with the secondary button. */
  function framed() {
    const session = smallSession()
    stroke(
      session,
      [
        { row: 0, column: 0 },
        { row: 0, column: 4 },
        { row: 4, column: 4 },
        { row: 4, column: 0 },
        { row: 0, column: 0 },
      ],
      'secondary',
    )
    session.dispatch({ type: 'select-tool', tool: 'fill' })
    return session
  }

  it('fills the 4-connected area under the pointer, inside the frame only', () => {
    const session = framed()

    stroke(session, [{ row: 2, column: 2 }])

    expect(cellAt(session, 1, 1)).toBe(1)
    expect(cellAt(session, 3, 3)).toBe(1)
    expect(cellAt(session, 5, 5)).toBe(0)
    expect(cellAt(session, 0, 0)).toBe(2)
  })

  it('fills with the previous yarn on the secondary button', () => {
    const session = framed()

    stroke(session, [{ row: 6, column: 6 }], 'secondary')

    expect(cellAt(session, 6, 6)).toBe(2)
    expect(cellAt(session, 2, 2)).toBe(0)
  })

  it('counts only the press: moving the pointer fills nothing more', () => {
    const session = framed()

    stroke(session, [
      { row: 2, column: 2 },
      { row: 6, column: 6 },
    ])

    expect(cellAt(session, 6, 6)).toBe(0)
  })

  it('is one edit, undone in one step', () => {
    const session = framed()

    stroke(session, [{ row: 6, column: 6 }])
    session.dispatch({ type: 'undo' })

    expect(cellAt(session, 6, 6)).toBe(0)
    expect(cellAt(session, 7, 9)).toBe(0)
    session.dispatch({ type: 'undo' })
    expect(painted(session)).toEqual([])
    expect(session.state.canUndo).toBe(false)
  })

  it('makes no edit when filling with the same yarn', () => {
    const session = framed()

    session.dispatch({ type: 'mark-saved' })
    stroke(session, [{ row: 0, column: 2 }], 'secondary')
    expect(session.state.unsavedToFile).toBe(false)
    session.dispatch({ type: 'undo' })

    expect(painted(session)).toEqual([])
    expect(session.state.canUndo).toBe(false)
  })

  it('is rolled back on cancel', () => {
    const session = framed()

    session.dispatch({
      type: 'pointer-down',
      cell: { row: 2, column: 2 },
      button: 'primary',
      shift: false,
    })
    session.dispatch({ type: 'cancel-gesture' })

    expect(cellAt(session, 2, 2)).toBe(0)
    session.dispatch({ type: 'undo' })
    expect(session.state.canUndo).toBe(false)
  })
})

describe('gesture', () => {
  it('rolls the stroke back on cancel and leaves the undo history as it was', () => {
    const session = smallSession()
    stroke(session, [{ row: 5, column: 5 }])
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 0 },
      button: 'primary',
      shift: false,
    })
    session.dispatch({ type: 'pointer-move', cell: { row: 0, column: 4 }, shift: false })
    session.dispatch({ type: 'cancel-gesture' })
    session.dispatch({ type: 'pointer-move', cell: { row: 2, column: 4 }, shift: false })
    session.dispatch({ type: 'pointer-up' })

    expect(painted(session)).toEqual([{ row: 5, column: 5, yarn: 1 }])
    expect(events.at(-2)).toMatchObject({ type: 'patch' })
    session.dispatch({ type: 'undo' })
    expect(painted(session)).toEqual([])
    expect(session.state.canUndo).toBe(false)
  })

  it('is cancelled by a second button pressed during it', () => {
    const session = smallSession()

    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 0 },
      button: 'primary',
      shift: false,
    })
    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 0 },
      button: 'secondary',
      shift: false,
    })
    session.dispatch({ type: 'pointer-up' })

    expect(painted(session)).toEqual([])
    expect(session.state.canUndo).toBe(false)
    expect(session.state.gestureActive).toBe(false)
  })

  it('makes no edit when the stroke changes nothing', () => {
    const session = smallSession()
    stroke(session, [
      { row: 0, column: 0 },
      { row: 0, column: 3 },
    ])

    stroke(session, [
      { row: 0, column: 1 },
      { row: 0, column: 2 },
    ])
    session.dispatch({ type: 'select-tool', tool: 'eraser' })
    stroke(session, [
      { row: 4, column: 0 },
      { row: 4, column: 9 },
    ])
    session.dispatch({ type: 'undo' })

    expect(painted(session)).toEqual([])
    expect(session.state.canUndo).toBe(false)
  })

  it('ignores tool changes and undo/redo during the gesture', () => {
    const session = smallSession()
    stroke(session, [{ row: 5, column: 5 }])

    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 0 },
      button: 'primary',
      shift: false,
    })
    session.dispatch({ type: 'select-tool', tool: 'eraser' })
    session.dispatch({ type: 'undo' })
    session.dispatch({ type: 'pointer-move', cell: { row: 0, column: 1 }, shift: false })
    session.dispatch({ type: 'pointer-up' })

    expect(session.state.tool).toBe('brush')
    expect(painted(session).map(({ row, column }) => ({ row, column }))).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 5, column: 5 },
    ])
  })

  it('reports that a gesture is under way', () => {
    const session = smallSession()
    const states: boolean[] = []
    session.subscribe(() => states.push(session.state.gestureActive))

    stroke(session, [{ row: 0, column: 0 }])

    expect(states[0]).toBe(true)
    expect(states.at(-1)).toBe(false)
  })
})

describe('undo and redo', () => {
  it('undoes a whole stroke in one step and redoes it', () => {
    const session = smallSession()
    stroke(session, [
      { row: 0, column: 0 },
      { row: 0, column: 4 },
      { row: 3, column: 4 },
    ])
    const after = painted(session)

    session.dispatch({ type: 'undo' })
    expect(painted(session)).toEqual([])
    expect(session.state.canUndo).toBe(false)
    expect(session.state.canRedo).toBe(true)

    session.dispatch({ type: 'redo' })
    expect(painted(session)).toEqual(after)
    expect(session.state.canRedo).toBe(false)
  })

  it('sends the patch it applies', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 2 }])
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({ type: 'undo' })
    session.dispatch({ type: 'redo' })

    expect(events).toEqual([
      { type: 'patch', patch: { kind: 'cells', cells: [{ index: 2, before: 1, after: 0 }] } },
      { type: 'patch', patch: { kind: 'cells', cells: [{ index: 2, before: 0, after: 1 }] } },
    ])
  })

  it('keeps the last 200 edits: the 201st pushes out the first', () => {
    const session = smallSession()
    // Even edits paint the cell, odd ones erase it.
    for (let i = 0; i < 201; i++) {
      session.dispatch({ type: 'select-tool', tool: i % 2 ? 'eraser' : 'brush' })
      stroke(session, [{ row: 0, column: 0 }])
    }
    let undone = 0
    while (session.state.canUndo) {
      session.dispatch({ type: 'undo' })
      undone++
    }

    expect(undone).toBe(200)
    // The first edit stays: it left the history.
    expect(cellAt(session, 0, 0)).toBe(1)
  })

  it('drops the redo history on a new edit after undo', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 0 }])
    stroke(session, [{ row: 0, column: 1 }])
    session.dispatch({ type: 'undo' })

    stroke(session, [{ row: 0, column: 2 }])
    session.dispatch({ type: 'redo' })

    expect(session.state.canRedo).toBe(false)
    expect(painted(session).map((c) => c.column)).toEqual([0, 2])
  })

  it('starts the history afresh when the chart is replaced', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 0 }])

    session.dispatch({ type: 'replace-chart', chart: createChart(10, 8, now) })

    expect(session.state.canUndo).toBe(false)
  })
})

describe('unsaved to file', () => {
  it('starts clean; an edit sets it and saving clears it', () => {
    const session = smallSession()
    expect(session.state.unsavedToFile).toBe(false)

    stroke(session, [{ row: 0, column: 0 }])
    expect(session.state.unsavedToFile).toBe(true)

    session.dispatch({ type: 'mark-saved' })
    expect(session.state.unsavedToFile).toBe(false)
  })

  it('is cleared by undo back to the saved edit and set again by redo', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 0 }])
    session.dispatch({ type: 'mark-saved' })
    stroke(session, [{ row: 0, column: 1 }])

    session.dispatch({ type: 'undo' })
    expect(session.state.unsavedToFile).toBe(false)

    session.dispatch({ type: 'redo' })
    expect(session.state.unsavedToFile).toBe(true)
  })

  it('is cleared by undo back to an empty history saved as it was', () => {
    const session = smallSession()
    session.dispatch({ type: 'mark-saved' })
    stroke(session, [{ row: 0, column: 0 }])

    session.dispatch({ type: 'undo' })

    expect(session.state.unsavedToFile).toBe(false)
  })

  it('stays until the next save once the saved edit was dropped by a new edit after undo', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 0 }])
    session.dispatch({ type: 'mark-saved' })
    session.dispatch({ type: 'undo' })

    stroke(session, [{ row: 0, column: 1 }])
    session.dispatch({ type: 'undo' })
    expect(session.state.unsavedToFile).toBe(true)

    session.dispatch({ type: 'mark-saved' })
    expect(session.state.unsavedToFile).toBe(false)
  })

  it('stays when the saved point was pushed out past the history depth', () => {
    const session = smallSession()
    session.dispatch({ type: 'mark-saved' })
    for (let i = 0; i < 201; i++) {
      session.dispatch({ type: 'select-tool', tool: i % 2 ? 'eraser' : 'brush' })
      stroke(session, [{ row: 0, column: 0 }])
    }

    while (session.state.canUndo) session.dispatch({ type: 'undo' })

    // The history is empty again, but the first edit is still in the chart.
    expect(session.state.unsavedToFile).toBe(true)
  })

  it('is not set by a gesture that changes nothing or by the eyedropper', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 0 }])
    session.dispatch({ type: 'mark-saved' })

    stroke(session, [{ row: 0, column: 0 }])
    session.dispatch({ type: 'select-tool', tool: 'eyedropper' })
    stroke(session, [{ row: 0, column: 0 }])

    expect(session.state.unsavedToFile).toBe(false)
  })

  it('starts a new edit after saving, so undo of a colour drag goes back to the saved colour', () => {
    const session = smallSession()
    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { color: '#110000' }, merge: 'a' })
    session.dispatch({ type: 'mark-saved' })

    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { color: '#220000' }, merge: 'a' })
    expect(session.state.unsavedToFile).toBe(true)
    session.dispatch({ type: 'undo' })

    expect(session.state.chart.palette[1]?.color).toBe('#110000')
    expect(session.state.unsavedToFile).toBe(false)
  })

  it('is cleared when the chart is replaced', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 0 }])

    session.dispatch({ type: 'replace-chart', chart: createChart(10, 8, now) })

    expect(session.state.unsavedToFile).toBe(false)
  })

  it('is cleared by a new chart, even for a chart restored from the autosave', () => {
    const session = smallSession()
    session.dispatch({ type: 'replace-chart', chart: createChart(10, 8, now), unsavedToFile: true })

    session.dispatch({
      type: 'new-chart',
      width: 30,
      height: 20,
      gauge: { stitches: 20, rows: 28 },
    })

    expect(session.state.unsavedToFile).toBe(false)
  })

  it('is kept for a chart restored from the autosave until it is saved; undo cannot clear it', () => {
    const session = smallSession()

    session.dispatch({ type: 'replace-chart', chart: createChart(10, 8, now), unsavedToFile: true })
    expect(session.state.unsavedToFile).toBe(true)
    stroke(session, [{ row: 0, column: 0 }])
    session.dispatch({ type: 'undo' })
    expect(session.state.unsavedToFile).toBe(true)

    session.dispatch({ type: 'mark-saved' })
    expect(session.state.unsavedToFile).toBe(false)
  })

  it('tells subscribers when saving clears it, and stays quiet when there was nothing to clear', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 0 }])
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({ type: 'mark-saved' })
    session.dispatch({ type: 'mark-saved' })

    expect(events).toEqual([{ type: 'state' }])
  })

  it('ignores saving during a gesture', () => {
    const session = smallSession()
    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 0 },
      button: 'primary',
      shift: false,
    })

    session.dispatch({ type: 'mark-saved' })
    session.dispatch({ type: 'pointer-up' })

    expect(session.state.unsavedToFile).toBe(true)
  })
})

/** Cell indices of a 10-wide chart, sorted, for comparing with a preview. */
function indices(cells: readonly GridCell[]) {
  return cells.map(({ row, column }) => row * 10 + column).sort((a, b) => a - b)
}

function previewCells(session: EditorSession) {
  return [...(session.state.preview?.cells ?? [])].sort((a, b) => a - b)
}

function press(session: EditorSession, cell: GridCell, button: PointerButton = 'primary') {
  session.dispatch({ type: 'pointer-down', cell, button, shift: false })
}

function move(session: EditorSession, cell: GridCell, shift = false) {
  session.dispatch({ type: 'pointer-move', cell, shift })
}

describe('line', () => {
  function lineSession() {
    const session = smallSession()
    session.dispatch({ type: 'select-tool', tool: 'line' })
    return session
  }

  it('shows the line as a preview while dragging and paints it as one edit on release', () => {
    const session = lineSession()
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    press(session, { row: 1, column: 1 })
    move(session, { row: 3, column: 5 })

    expect(painted(session)).toEqual([])
    expect(events.filter((e) => e.type === 'patch')).toEqual([])
    expect(events).toContainEqual({ type: 'preview' })
    expect(session.state.preview).toMatchObject({ yarn: 1, size: { kind: 'line', length: 5 } })
    const shown = previewCells(session)
    expect(shown).toHaveLength(5)

    session.dispatch({ type: 'pointer-up' })

    expect(session.state.preview).toBeNull()
    expect(indices(painted(session))).toEqual(shown)
    expect(painted(session).every((c) => c.yarn === 1)).toBe(true)
    session.dispatch({ type: 'undo' })
    expect(painted(session)).toEqual([])
    expect(session.state.canUndo).toBe(false)
  })

  it('draws with the previous yarn by the secondary button', () => {
    const session = lineSession()

    stroke(
      session,
      [
        { row: 0, column: 0 },
        { row: 0, column: 3 },
      ],
      'secondary',
    )

    expect(painted(session).map((c) => c.yarn)).toEqual([2, 2, 2, 2])
  })

  it('lies flat with Shift at about 30° and on the diagonal 1:1 at about 40°', () => {
    const session = lineSession()

    press(session, { row: 7, column: 0 })
    // 3 rows over 5 columns: 31°.
    move(session, { row: 4, column: 5 }, true)
    expect(previewCells(session)).toEqual(
      indices([0, 1, 2, 3, 4, 5].map((column) => ({ row: 7, column }))),
    )

    // 4 rows over 5 columns: 39°; the pointer projects 4.5 cells along the diagonal, rounded to 5.
    move(session, { row: 3, column: 5 }, true)
    expect(previewCells(session)).toEqual(
      indices([0, 1, 2, 3, 4, 5].map((step) => ({ row: 7 - step, column: step }))),
    )
  })

  it('paints the line its preview shows, whatever Shift is on release', () => {
    const session = lineSession()
    press(session, { row: 7, column: 0 })
    move(session, { row: 4, column: 5 })
    const shown = previewCells(session)

    session.dispatch({ type: 'pointer-up', shift: true })

    expect(indices(painted(session))).toEqual(shown)
  })

  it('clips a line dragged off the grid and keeps its slope', () => {
    const session = lineSession()

    const from = { row: 6, column: 6 }
    const to = { row: 2, column: 14 }
    stroke(session, [from, to])

    // The line as on an unbounded grid, cut at the right edge: 1 row in 2 columns still.
    const unclipped = lineCells(from, to, { width: 100, height: 100 })
    expect(indices(painted(session))).toEqual(indices(unclipped.filter((c) => c.column < 10)))
    expect(painted(session)).toHaveLength(4)
  })

  it('leaves no cells, no edit and no preview when cancelled by Esc', () => {
    const session = lineSession()
    const events: EditorEvent[] = []
    press(session, { row: 1, column: 1 })
    move(session, { row: 1, column: 6 })
    session.subscribe((event) => events.push(event))

    session.dispatch({ type: 'cancel-gesture' })
    session.dispatch({ type: 'pointer-up' })

    expect(painted(session)).toEqual([])
    expect(session.state.preview).toBeNull()
    expect(session.state.canUndo).toBe(false)
    expect(events).toContainEqual({ type: 'preview' })
  })

  it('makes no edit over cells that already hold its yarn', () => {
    const session = lineSession()
    stroke(session, [
      { row: 2, column: 0 },
      { row: 2, column: 4 },
    ])

    stroke(session, [
      { row: 2, column: 1 },
      { row: 2, column: 3 },
    ])
    session.dispatch({ type: 'undo' })

    expect(painted(session)).toEqual([])
  })
})

describe('rectangle', () => {
  function rectangleSession() {
    const session = smallSession()
    session.dispatch({ type: 'select-tool', tool: 'rectangle' })
    return session
  }

  /** Cells of the rectangle rows 1–3, columns 2–5. */
  const outline = indices([
    ...[2, 3, 4, 5].flatMap((column) => [
      { row: 1, column },
      { row: 3, column },
    ]),
    { row: 2, column: 2 },
    { row: 2, column: 5 },
  ])
  const filled = indices(
    [1, 2, 3].flatMap((row) => [2, 3, 4, 5].map((column) => ({ row, column }))),
  )

  it('paints the outline when released without Shift and shows its size', () => {
    const session = rectangleSession()

    press(session, { row: 1, column: 2 })
    move(session, { row: 3, column: 5 })
    expect(session.state.preview?.size).toEqual({ kind: 'rectangle', width: 4, height: 3 })
    session.dispatch({ type: 'pointer-up', shift: false })

    expect(indices(painted(session))).toEqual(outline)
  })

  it('paints it filled when released with Shift, whatever Shift was while dragging', () => {
    const session = rectangleSession()

    press(session, { row: 1, column: 2 })
    move(session, { row: 3, column: 5 })
    session.dispatch({ type: 'pointer-up', shift: true })

    expect(indices(painted(session))).toEqual(filled)
    session.dispatch({ type: 'undo' })
    expect(painted(session)).toEqual([])
  })

  it('switches the preview as Shift goes down and up during the drag', () => {
    const session = rectangleSession()
    press(session, { row: 1, column: 2 })

    move(session, { row: 3, column: 5 })
    expect(previewCells(session)).toEqual(outline)
    move(session, { row: 3, column: 5 }, true)
    expect(previewCells(session)).toEqual(filled)
    move(session, { row: 3, column: 5 }, false)
    expect(previewCells(session)).toEqual(outline)
  })

  it('goes to the edge of the grid when dragged past it', () => {
    const session = rectangleSession()

    press(session, { row: 5, column: 7 })
    move(session, { row: 12, column: 20 }, true)
    expect(session.state.preview?.size).toEqual({ kind: 'rectangle', width: 3, height: 3 })
    session.dispatch({ type: 'pointer-up' })

    expect(indices(painted(session))).toEqual(
      indices([5, 6, 7].flatMap((row) => [7, 8, 9].map((column) => ({ row, column })))),
    )
  })

  it('makes no edit when cancelled by a second button', () => {
    const session = rectangleSession()
    press(session, { row: 1, column: 2 })
    move(session, { row: 3, column: 5 })

    press(session, { row: 3, column: 5 }, 'secondary')
    session.dispatch({ type: 'pointer-up' })

    expect(painted(session)).toEqual([])
    expect(session.state.preview).toBeNull()
    expect(session.state.canUndo).toBe(false)
  })
})

describe('tool', () => {
  it('starts with the brush and tells subscribers when it changes', () => {
    const session = createEditorSession({ clock })
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    expect(session.state.tool).toBe('brush')
    session.dispatch({ type: 'select-tool', tool: 'eraser' })

    expect(session.state.tool).toBe('eraser')
    expect(events).toEqual([{ type: 'state' }])
  })
})

describe('display mode', () => {
  it('starts in «цвет» and goes «цвет» → «узор» → «цвет+узор» → «цвет»', () => {
    expect(DISPLAY_MODES).toEqual(['color', 'pattern', 'color-pattern'])
    expect(createEditorSession({ clock }).state.displayMode).toBe('color')
    expect(DISPLAY_MODES.map(nextDisplayMode)).toEqual(['pattern', 'color-pattern', 'color'])
  })

  it('changes without an edit and tells subscribers', () => {
    const session = smallSession()
    session.dispatch({ type: 'mark-saved' })
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({ type: 'select-display-mode', mode: 'pattern' })

    expect(session.state.displayMode).toBe('pattern')
    expect(session.state.canUndo).toBe(false)
    expect(session.state.unsavedToFile).toBe(false)
    expect(events).toEqual([{ type: 'state' }])
  })

  it('is kept when the chart is replaced', () => {
    const session = smallSession()
    session.dispatch({ type: 'select-display-mode', mode: 'color-pattern' })

    session.dispatch({ type: 'replace-chart', chart: createChart(5, 5, now) })

    expect(session.state.displayMode).toBe('color-pattern')
  })

  it('is ignored during a gesture', () => {
    const session = smallSession()
    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 0 },
      button: 'primary',
      shift: false,
    })

    session.dispatch({ type: 'select-display-mode', mode: 'pattern' })

    expect(session.state.displayMode).toBe('color')
  })
})

describe('editor session', () => {
  it('starts with an empty 40×40 chart, yarn 1 current and yarn 2 previous', () => {
    const { state } = createEditorSession({ clock })

    expect(state.chart.width).toBe(40)
    expect(state.chart.height).toBe(40)
    expect(state.chart.cells.every((id) => id === 0)).toBe(true)
    expect(state.chart.properties.createdAt).toEqual(now)
    expect(state.currentYarn).toBe(1)
    expect(state.previousYarn).toBe(2)
  })

  it('sends «replaced» to subscribers when the chart is replaced', () => {
    const session = createEditorSession({ clock })
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))
    const chart = createChart(10, 8, now)

    session.dispatch({ type: 'replace-chart', chart })

    expect(events).toEqual([{ type: 'replaced' }])
    expect(session.state.chart).toBe(chart)
  })

  it('stops sending events to a subscriber that unsubscribed', () => {
    const session = createEditorSession({ clock })
    const kept: EditorEvent[] = []
    const dropped: EditorEvent[] = []
    session.subscribe((event) => kept.push(event))
    const unsubscribe = session.subscribe((event) => dropped.push(event))

    unsubscribe()
    session.dispatch({ type: 'replace-chart', chart: createChart(10, 8, now) })

    expect(kept).toHaveLength(1)
    expect(dropped).toEqual([])
  })
})

function addYarn(session: EditorSession) {
  session.dispatch({ type: 'add-yarn' })
  const added = session.state.chart.palette.at(-1)
  if (!added) throw new Error('No yarn')
  return added.id
}

function paletteIds(session: EditorSession) {
  return session.state.chart.palette.map((y) => y.id)
}

describe('yarn selection', () => {
  it('makes the chosen yarn current and the current one previous, with no edit', () => {
    const session = smallSession()
    const third = addYarn(session)
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({ type: 'select-yarn', yarn: third })

    expect(session.state.currentYarn).toBe(third)
    expect(session.state.previousYarn).toBe(1)
    expect(events).toEqual([{ type: 'state' }])
    session.dispatch({ type: 'undo' })
    expect(paletteIds(session)).toEqual([1, 2])
  })

  it('does nothing when the chosen yarn is already current', () => {
    const session = smallSession()
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({ type: 'select-yarn', yarn: 1 })

    expect(session.state.previousYarn).toBe(2)
    expect(events).toEqual([])
  })

  it('swaps the current and the previous yarn', () => {
    const session = smallSession()

    session.dispatch({ type: 'swap-yarns' })

    expect(session.state.currentYarn).toBe(2)
    expect(session.state.previousYarn).toBe(1)
  })

  it('ignores yarn changes during a gesture', () => {
    const session = smallSession()
    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 0 },
      button: 'primary',
      shift: false,
    })

    session.dispatch({ type: 'swap-yarns' })
    session.dispatch({ type: 'select-yarn', yarn: 2 })
    session.dispatch({ type: 'pointer-move', cell: { row: 0, column: 1 }, shift: false })
    session.dispatch({ type: 'pointer-up' })

    expect(session.state.currentYarn).toBe(1)
    expect(cellAt(session, 0, 1)).toBe(1)
  })
})

describe('palette edits', () => {
  it('adds a yarn at the end as one edit, undone and redone', () => {
    const session = smallSession()

    const added = addYarn(session)

    expect(paletteIds(session)).toEqual([1, 2, added])
    session.dispatch({ type: 'undo' })
    expect(paletteIds(session)).toEqual([1, 2])
    session.dispatch({ type: 'redo' })
    expect(paletteIds(session)).toEqual([1, 2, added])
  })

  it('reports «palette full» instead of adding the 65 536th yarn', () => {
    const session = smallSession()
    const full = Array.from({ length: 65_535 }, (_, i) => ({
      id: i + 1,
      color: '#808080',
      pattern: null,
      name: '',
    }))
    session.dispatch({
      type: 'replace-chart',
      chart: { ...createChart(10, 8, now), palette: full },
    })
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({ type: 'add-yarn' })

    expect(session.state.chart.palette).toHaveLength(65_535)
    expect(events).toEqual([{ type: 'rejected', code: 'palette-full' }])
    expect(session.state.canUndo).toBe(false)
  })

  it('changes a yarn pattern as one edit; undo gives the old one back, and «без узора» is null', () => {
    const session = smallSession()

    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { pattern: 'plus' } })
    expect(session.state.chart.palette[1]?.pattern).toBe('plus')
    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { pattern: null } })
    expect(session.state.chart.palette[1]?.pattern).toBeNull()
    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { pattern: null } })

    session.dispatch({ type: 'undo' })
    expect(session.state.chart.palette[1]?.pattern).toBe('plus')
    session.dispatch({ type: 'undo' })
    expect(session.state.chart.palette[1]?.pattern).toBe('circle-filled')
    expect(session.state.canUndo).toBe(false)
  })

  it('changes a yarn colour and name as edits and sends them as palette patches', () => {
    const session = smallSession()
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { color: '#ff0000' } })
    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { name: 'Alize 55' } })

    expect(session.state.chart.palette[1]).toMatchObject({ color: '#ff0000', name: 'Alize 55' })
    expect(events.map((e) => e.type === 'patch' && e.patch.kind)).toEqual(['palette', 'palette'])
    session.dispatch({ type: 'undo' })
    expect(session.state.chart.palette[1]).toMatchObject({ color: '#ff0000', name: '' })
    session.dispatch({ type: 'undo' })
    expect(session.state.chart.palette[1]).toMatchObject({ color: '#000000' })
  })

  it('makes no edit when the yarn already has the value', () => {
    const session = smallSession()

    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { color: '#000000', name: '' } })

    expect(session.state.canUndo).toBe(false)
  })

  it('merges changes with the same merge key into one edit, as a colour picker drag', () => {
    const session = smallSession()
    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { name: 'first' } })

    for (const color of ['#110000', '#220000', '#330000'])
      session.dispatch({ type: 'update-yarn', yarn: 2, changes: { color }, merge: 'popover-1' })
    session.dispatch({
      type: 'update-yarn',
      yarn: 2,
      changes: { color: '#440000' },
      merge: 'popover-2',
    })

    session.dispatch({ type: 'undo' })
    expect(session.state.chart.palette[1]?.color).toBe('#330000')
    session.dispatch({ type: 'undo' })
    expect(session.state.chart.palette[1]).toMatchObject({ color: '#000000', name: 'first' })
  })

  it('does not merge into an edit that was undone', () => {
    const session = smallSession()
    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { color: '#110000' }, merge: 'a' })
    session.dispatch({ type: 'undo' })

    session.dispatch({ type: 'update-yarn', yarn: 2, changes: { color: '#220000' }, merge: 'a' })
    session.dispatch({ type: 'undo' })

    expect(session.state.chart.palette[1]?.color).toBe('#000000')
    expect(session.state.canUndo).toBe(false)
  })

  it('removes an unused yarn as an edit; undo puts it back in its place', () => {
    const session = smallSession()
    addYarn(session)

    session.dispatch({ type: 'remove-yarn', yarn: 2 })
    expect(paletteIds(session)).toEqual([1, 3])

    session.dispatch({ type: 'undo' })
    expect(paletteIds(session)).toEqual([1, 2, 3])
  })

  it('refuses to remove a used yarn without a replacement', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 0 }], 'secondary')

    session.dispatch({ type: 'remove-yarn', yarn: 2 })

    expect(paletteIds(session)).toEqual([1, 2])
    session.dispatch({ type: 'undo' })
    expect(session.state.canUndo).toBe(false)
  })

  it('refuses to remove the last yarn', () => {
    const session = smallSession()
    session.dispatch({ type: 'remove-yarn', yarn: 2 })

    session.dispatch({ type: 'remove-yarn', yarn: 1 })

    expect(paletteIds(session)).toEqual([1])
  })

  it('moves the selection off a removed yarn', () => {
    const session = smallSession()
    const third = addYarn(session)
    session.dispatch({ type: 'select-yarn', yarn: third })

    session.dispatch({ type: 'remove-yarn', yarn: third })
    expect(session.state.currentYarn).toBe(1)
    expect(session.state.previousYarn).toBe(2)

    session.dispatch({ type: 'remove-yarn', yarn: 2 })
    expect(session.state.currentYarn).toBe(1)
    expect(session.state.previousYarn).toBe(1)
  })

  it('removes a used yarn with a replacement as one edit, undone with its cells and its id', () => {
    const session = smallSession()
    const third = addYarn(session)
    stroke(session, [{ row: 0, column: 0 }], 'secondary')
    stroke(session, [{ row: 1, column: 1 }], 'secondary')
    const palette = session.state.chart.palette

    session.dispatch({ type: 'remove-yarn', yarn: 2, replacement: third })
    expect(painted(session)).toEqual([
      { row: 0, column: 0, yarn: third },
      { row: 1, column: 1, yarn: third },
    ])
    expect(paletteIds(session)).toEqual([1, third])
    expect(session.state.stitchCounts.get(third)).toBe(2)

    session.dispatch({ type: 'undo' })
    expect(painted(session)).toEqual([
      { row: 0, column: 0, yarn: 2 },
      { row: 1, column: 1, yarn: 2 },
    ])
    expect(session.state.chart.palette).toEqual(palette)
    expect(session.state.stitchCounts.get(2)).toBe(2)

    session.dispatch({ type: 'redo' })
    expect(paletteIds(session)).toEqual([1, third])
  })

  it('removes a used yarn with an empty replacement, leaving its cells empty', () => {
    const session = smallSession()
    addYarn(session)
    stroke(session, [{ row: 0, column: 0 }], 'secondary')

    session.dispatch({ type: 'remove-yarn', yarn: 2, replacement: 0 })

    expect(painted(session)).toEqual([])
    expect(paletteIds(session)).toEqual([1, 3])
  })

  it('replaces a yarn in the whole chart as one edit, keeping it in the palette with no stitches', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 0 }], 'secondary')
    stroke(session, [{ row: 2, column: 2 }])

    session.dispatch({ type: 'replace-yarn', yarn: 2, replacement: 0 })
    expect(painted(session)).toEqual([{ row: 2, column: 2, yarn: 1 }])
    expect(paletteIds(session)).toEqual([1, 2])
    expect(session.state.stitchCounts.get(2)).toBeUndefined()

    session.dispatch({ type: 'replace-yarn', yarn: 1, replacement: 2 })
    expect(painted(session)).toEqual([{ row: 2, column: 2, yarn: 2 }])

    session.dispatch({ type: 'undo' })
    session.dispatch({ type: 'undo' })
    expect(painted(session)).toEqual([
      { row: 0, column: 0, yarn: 2 },
      { row: 2, column: 2, yarn: 1 },
    ])
  })

  it('ignores a replacement by the yarn itself, by a yarn not in the palette and of an unused yarn', () => {
    const session = smallSession()
    stroke(session, [{ row: 0, column: 0 }], 'secondary')

    session.dispatch({ type: 'replace-yarn', yarn: 2, replacement: 2 })
    session.dispatch({ type: 'replace-yarn', yarn: 2, replacement: 9 })
    session.dispatch({ type: 'remove-yarn', yarn: 2, replacement: 2 })
    session.dispatch({ type: 'replace-yarn', yarn: 1, replacement: 2 })
    session.dispatch({ type: 'undo' })

    expect(painted(session)).toEqual([])
    expect(session.state.canUndo).toBe(false)
  })

  it('gives the slot of a yarn removed with a replacement that replacement', () => {
    const session = smallSession()
    const third = addYarn(session)
    stroke(session, [{ row: 0, column: 0 }])
    session.dispatch({ type: 'select-yarn', yarn: third })
    // Current 3, previous 1.

    session.dispatch({ type: 'remove-yarn', yarn: 1, replacement: 2 })
    expect(session.state.currentYarn).toBe(third)
    expect(session.state.previousYarn).toBe(2)

    stroke(session, [{ row: 1, column: 1 }])
    session.dispatch({ type: 'remove-yarn', yarn: third, replacement: 0 })
    expect(session.state.currentYarn).toBe(2)
    expect(session.state.previousYarn).toBe(2)
  })

  it('gives the slot the first yarn of the palette when the replacement is empty', () => {
    const session = smallSession()
    const third = addYarn(session)
    stroke(session, [{ row: 0, column: 0 }], 'secondary')
    session.dispatch({ type: 'select-yarn', yarn: third })
    // Current 3, previous 1; yarn 2 used.
    session.dispatch({ type: 'select-yarn', yarn: 2 })
    // Current 2, previous 3.

    session.dispatch({ type: 'remove-yarn', yarn: 2, replacement: 0 })

    expect(session.state.currentYarn).toBe(1)
    expect(session.state.previousYarn).toBe(third)
  })

  it('moves the selection off a yarn whose adding is undone', () => {
    const session = smallSession()
    const third = addYarn(session)
    session.dispatch({ type: 'select-yarn', yarn: third })

    session.dispatch({ type: 'undo' })

    expect(session.state.currentYarn).toBe(1)
    expect(session.state.previousYarn).toBe(2)
  })
})

describe('yarn reordering', () => {
  it('moves a yarn to a position as one edit, the grid byte for byte the same; undo gives the order back', () => {
    const session = smallSession()
    const yarn3 = addYarn(session)
    stroke(session, [{ row: 0, column: 0 }])
    stroke(session, [{ row: 1, column: 1 }], 'secondary')
    session.dispatch({ type: 'select-yarn', yarn: yarn3 })
    stroke(session, [{ row: 2, column: 2 }])
    const cells = session.state.chart.cells.slice()

    session.dispatch({ type: 'move-yarn', yarn: yarn3, position: 0 })

    expect(paletteIds(session)).toEqual([yarn3, 1, 2])
    expect(session.state.chart.cells).toEqual(cells)
    session.dispatch({ type: 'undo' })
    expect(paletteIds(session)).toEqual([1, 2, yarn3])
    session.dispatch({ type: 'redo' })
    expect(paletteIds(session)).toEqual([yarn3, 1, 2])
  })

  it('keeps the current and the previous yarn, now under their new numbers', () => {
    const session = smallSession()
    const yarn3 = addYarn(session)
    session.dispatch({ type: 'select-yarn', yarn: yarn3 })

    session.dispatch({ type: 'move-yarn', yarn: yarn3, position: 0 })

    expect(session.state).toMatchObject({ currentYarn: yarn3, previousYarn: 1 })
    // What the key of a number does: picks the yarn at that place in the palette.
    const byNumber = (n: number) =>
      session.dispatch({ type: 'select-yarn', yarn: session.state.chart.palette[n - 1]!.id })
    byNumber(3)
    expect(session.state.currentYarn).toBe(2)
    byNumber(1)
    expect(session.state.currentYarn).toBe(yarn3)
  })

  it('makes no edit for a drop on the place the yarn is at', () => {
    const session = smallSession()
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({ type: 'move-yarn', yarn: 2, position: 1 })

    expect(session.state.canUndo).toBe(false)
    expect(events).toEqual([])
  })
})

describe('stitch counts', () => {
  it('follow a stroke, its undo and its redo', () => {
    const session = smallSession()
    stroke(session, [{ row: 7, column: 0 }], 'secondary')

    stroke(session, [
      { row: 0, column: 0 },
      { row: 0, column: 3 },
    ])
    expect(session.state.stitchCounts.get(1)).toBe(4)
    expect(session.state.stitchCounts.get(2)).toBe(1)

    session.dispatch({ type: 'undo' })
    expect(session.state.stitchCounts.get(1) ?? 0).toBe(0)

    session.dispatch({ type: 'redo' })
    expect(session.state.stitchCounts.get(1)).toBe(4)
  })

  it('are counted afresh for a replaced chart', () => {
    const session = smallSession()
    const chart = createChart(10, 8, now)
    chart.cells.fill(2, 0, 5)

    session.dispatch({ type: 'replace-chart', chart })

    expect(session.state.stitchCounts.get(2)).toBe(5)
  })
})

describe('eyedropper', () => {
  /** Yarn 1 at (0, 0), yarn 2 at (0, 1), a third yarn at (0, 2); the brush and yarn 1 current. */
  function paintedSession() {
    const session = smallSession()
    const third = addYarn(session)
    stroke(session, [{ row: 0, column: 0 }])
    stroke(session, [{ row: 0, column: 1 }], 'secondary')
    session.dispatch({ type: 'select-yarn', yarn: third })
    stroke(session, [{ row: 0, column: 2 }])
    session.dispatch({ type: 'select-yarn', yarn: 1 })
    session.dispatch({ type: 'select-yarn', yarn: 2 })
    session.dispatch({ type: 'select-yarn', yarn: 1 })
    return { session, third }
  }

  it('takes the yarn of the cell: it becomes current, the current one previous', () => {
    const { session, third } = paintedSession()
    session.dispatch({ type: 'select-tool', tool: 'eyedropper' })

    stroke(session, [{ row: 0, column: 2 }])

    expect(session.state.currentYarn).toBe(third)
    expect(session.state.previousYarn).toBe(1)
  })

  it('leaves the current yarn as it was on an empty cell', () => {
    const { session } = paintedSession()
    session.dispatch({ type: 'select-tool', tool: 'eyedropper' })

    stroke(session, [{ row: 5, column: 5 }])

    expect(session.state.currentYarn).toBe(1)
    expect(session.state.previousYarn).toBe(2)
  })

  it('gives back the tool it was picked from after a click', () => {
    const { session } = paintedSession()
    session.dispatch({ type: 'select-tool', tool: 'eraser' })
    session.dispatch({ type: 'select-tool', tool: 'eyedropper' })

    stroke(session, [{ row: 0, column: 1 }])

    expect(session.state.tool).toBe('eraser')
  })

  it('puts the yarn in the previous slot with the secondary button, leaving the current one', () => {
    const { session, third } = paintedSession()
    session.dispatch({ type: 'select-tool', tool: 'eyedropper' })

    stroke(session, [{ row: 0, column: 2 }], 'secondary')

    expect(session.state.currentYarn).toBe(1)
    expect(session.state.previousYarn).toBe(third)
  })

  it('takes the yarn live while dragging, the result is the cell it is released on', () => {
    const { session, third } = paintedSession()
    session.dispatch({ type: 'select-tool', tool: 'eyedropper' })
    const seen: number[] = []
    session.subscribe(() => seen.push(session.state.currentYarn))

    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 1 },
      button: 'primary',
      shift: false,
    })
    session.dispatch({ type: 'pointer-move', cell: { row: 0, column: 2 }, shift: false })
    session.dispatch({ type: 'pointer-move', cell: { row: 0, column: 0 }, shift: false })
    session.dispatch({ type: 'pointer-move', cell: { row: 3, column: 3 }, shift: false })
    session.dispatch({ type: 'pointer-up' })

    expect(seen).toContain(2)
    expect(seen).toContain(third)
    // Back on the yarn that was current: the selection is as before the drag, the empty cell keeps it.
    expect(session.state.currentYarn).toBe(1)
    expect(session.state.previousYarn).toBe(2)
  })

  it('puts the selection back when cancelled', () => {
    const { session } = paintedSession()
    session.dispatch({ type: 'select-tool', tool: 'eyedropper' })

    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 2 },
      button: 'primary',
      shift: false,
    })
    session.dispatch({ type: 'cancel-gesture' })

    expect(session.state.currentYarn).toBe(1)
    expect(session.state.previousYarn).toBe(2)
  })

  it('makes no edit: undo after it undoes the stroke before', () => {
    const { session } = paintedSession()
    session.dispatch({ type: 'select-tool', tool: 'eyedropper' })

    stroke(session, [{ row: 0, column: 2 }])
    session.dispatch({ type: 'undo' })

    expect(cellAt(session, 0, 2)).toBe(0)
  })

  it('is the active tool while held, and the selected tool comes back on release', () => {
    const { session, third } = paintedSession()

    session.dispatch({ type: 'hold-eyedropper', held: true })
    expect(session.state.activeTool).toBe('eyedropper')
    stroke(session, [{ row: 0, column: 2 }])
    expect(session.state.activeTool).toBe('eyedropper')
    session.dispatch({ type: 'hold-eyedropper', held: false })

    expect(session.state.currentYarn).toBe(third)
    expect(session.state.tool).toBe('brush')
    expect(session.state.activeTool).toBe('brush')
    expect(cellAt(session, 0, 2)).toBe(third)
  })

  it('is not taken up by holding during a gesture', () => {
    const { session } = paintedSession()
    session.dispatch({
      type: 'pointer-down',
      cell: { row: 4, column: 0 },
      button: 'primary',
      shift: false,
    })

    session.dispatch({ type: 'hold-eyedropper', held: true })
    session.dispatch({ type: 'pointer-move', cell: { row: 4, column: 1 }, shift: false })
    session.dispatch({ type: 'pointer-up' })

    expect(session.state.activeTool).toBe('brush')
    expect(cellAt(session, 4, 1)).toBe(1)
  })

  it('is let go when released during a gesture it started', () => {
    const { session, third } = paintedSession()
    session.dispatch({ type: 'hold-eyedropper', held: true })
    session.dispatch({
      type: 'pointer-down',
      cell: { row: 0, column: 2 },
      button: 'primary',
      shift: false,
    })

    session.dispatch({ type: 'hold-eyedropper', held: false })
    session.dispatch({ type: 'pointer-up' })

    expect(session.state.currentYarn).toBe(third)
    expect(session.state.activeTool).toBe('brush')
  })
})

describe('chart properties', () => {
  it('changes a property as one edit, which undo takes back and redo makes again', () => {
    const session = smallSession()
    const before = session.state.chart.properties

    session.dispatch({ type: 'update-properties', changes: { title: 'Олени', majorStep: 5 } })
    expect(session.state.chart.properties).toMatchObject({ title: 'Олени', majorStep: 5 })
    expect(session.state.unsavedToFile).toBe(true)

    session.dispatch({ type: 'undo' })
    expect(session.state.chart.properties).toEqual(before)
    expect(session.state.canUndo).toBe(false)

    session.dispatch({ type: 'redo' })
    expect(session.state.chart.properties).toMatchObject({ title: 'Олени', majorStep: 5 })
  })

  it('rejects a gauge of 0 with its code and changes nothing', () => {
    const session = smallSession()
    const before = session.state.chart.properties
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({ type: 'update-properties', changes: { gauge: { stitches: 0, rows: 28 } } })

    expect(events).toEqual([{ type: 'rejected', code: 'gauge-not-positive' }])
    expect(session.state.chart.properties).toBe(before)
    expect(session.state.canUndo).toBe(false)
  })

  it('makes no edit when a committed field holds the same value', () => {
    const session = smallSession()
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    session.dispatch({
      type: 'update-properties',
      changes: { title: '', gauge: { rows: 28, stitches: 20 } },
    })

    expect(events).toEqual([])
    expect(session.state.canUndo).toBe(false)
    expect(session.state.unsavedToFile).toBe(false)
  })

  it('moves «modifiedAt» to the time of each edit, undo too, and keeps «createdAt»', () => {
    let time = new Date('2026-10-25T10:00:00.000Z')
    const session = createEditorSession({ clock: { now: () => time } })
    session.dispatch({ type: 'replace-chart', chart: createChart(10, 8, time) })

    time = new Date('2026-10-25T11:00:00.000Z')
    stroke(session, [{ row: 0, column: 0 }])
    expect(session.state.chart.properties.modifiedAt).toEqual(time)

    time = new Date('2026-10-25T12:00:00.000Z')
    session.dispatch({ type: 'update-properties', changes: { title: 'Олени' } })
    expect(session.state.chart.properties.modifiedAt).toEqual(time)

    time = new Date('2026-10-25T13:00:00.000Z')
    session.dispatch({ type: 'undo' })
    expect(session.state.chart.properties.modifiedAt).toEqual(time)
    expect(session.state.chart.properties.createdAt).toEqual(new Date('2026-10-25T10:00:00.000Z'))
  })
})

describe('new chart', () => {
  it('replaces the chart with an empty one of the size, with the default palette and no history', () => {
    const later = new Date('2026-10-25T12:00:00.000Z')
    let time = now
    const session = createEditorSession({ clock: { now: () => time } })
    session.dispatch({ type: 'replace-chart', chart: createChart(10, 8, now) })
    session.dispatch({ type: 'add-yarn' })
    session.dispatch({ type: 'select-yarn', yarn: 3 })
    stroke(session, [{ row: 0, column: 0 }])
    const events: EditorEvent[] = []
    session.subscribe((event) => events.push(event))

    time = later
    session.dispatch({
      type: 'new-chart',
      width: 30,
      height: 20,
      gauge: { stitches: 22, rows: 30 },
    })

    const { chart } = session.state
    expect(events).toEqual([{ type: 'replaced' }])
    expect([chart.width, chart.height]).toEqual([30, 20])
    expect(chart.cells).toEqual(new Uint16Array(30 * 20))
    expect(chart.palette).toEqual(createChart(1, 1, now).palette)
    expect(chart.properties).toEqual({
      ...createChart(1, 1, later).properties,
      gauge: { stitches: 22, rows: 30 },
    })
    expect([session.state.currentYarn, session.state.previousYarn]).toEqual([1, 2])
    expect(session.state.stitchCounts.size).toBe(0)
    expect(session.state.canUndo).toBe(false)
    expect(session.state.canRedo).toBe(false)
    expect(session.state.unsavedToFile).toBe(false)
  })

  it('ignores a size out of 1–500 and a gauge that is not positive', () => {
    const session = smallSession()
    const chart = session.state.chart

    session.dispatch({ type: 'new-chart', width: 0, height: 20, gauge: { stitches: 20, rows: 28 } })
    session.dispatch({
      type: 'new-chart',
      width: 30,
      height: 501,
      gauge: { stitches: 20, rows: 28 },
    })
    session.dispatch({ type: 'new-chart', width: 30, height: 20, gauge: { stitches: 0, rows: 28 } })

    expect(session.state.chart).toBe(chart)
  })
})
