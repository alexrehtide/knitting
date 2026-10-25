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

  it('refuses to remove a used yarn', () => {
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

  it('moves the selection off a yarn whose adding is undone', () => {
    const session = smallSession()
    const third = addYarn(session)
    session.dispatch({ type: 'select-yarn', yarn: third })

    session.dispatch({ type: 'undo' })

    expect(session.state.currentYarn).toBe(1)
    expect(session.state.previousYarn).toBe(2)
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
