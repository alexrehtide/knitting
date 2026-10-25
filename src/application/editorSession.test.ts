import { describe, expect, it } from 'vitest'
import { createChart } from '../domain/chart'
import type { Clock } from '../domain/clock'
import type { GridCell } from '../domain/numbering'
import {
  createEditorSession,
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
