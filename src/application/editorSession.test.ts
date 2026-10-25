import { describe, expect, it } from 'vitest'
import { createChart } from '../domain/chart'
import type { Clock } from '../domain/clock'
import { createEditorSession, type EditorEvent } from './editorSession'

const now = new Date('2026-10-25T10:00:00.000Z')
const clock: Clock = { now: () => now }

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
