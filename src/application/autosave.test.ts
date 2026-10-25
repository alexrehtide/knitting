import { describe, expect, it } from 'vitest'
import { createChart, type Chart } from '../domain/chart'
import type { Clock } from '../domain/clock'
import {
  AUTOSAVE_DELAY,
  SLOW_WRITE_DELAY,
  createAutosave,
  type AutosaveEvent,
  type AutosaveRecord,
  type AutosaveStorage,
} from './autosave'
import type { ChartFileFormat } from './chartFile'
import type { Delay } from './delay'
import { createEditorSession, type EditorSession } from './editorSession'

const now = new Date('2026-10-25T10:00:00.000Z')
const clock: Clock = { now: () => now }

/** Timers that run only when the test moves the time on. */
function fakeDelay() {
  let time = 0
  let next = 0
  const pending = new Map<number, { at: number; callback: () => void }>()
  const delay: Delay = (callback, ms) => {
    const id = next++
    pending.set(id, { at: time + ms, callback })
    return () => pending.delete(id)
  }
  function advance(ms: number) {
    const end = time + ms
    for (;;) {
      const due = [...pending].filter(([, t]) => t.at <= end).sort(([, a], [, b]) => a.at - b.at)[0]
      if (!due) break
      const [id, timer] = due
      pending.delete(id)
      time = timer.at
      timer.callback()
    }
    time = end
  }
  return { delay, advance }
}

interface Write {
  readonly record: AutosaveRecord
  resolve(): void
  reject(): void
}

/** Storage whose writes wait until the test settles them. */
function fakeStorage(stored?: unknown) {
  const writes: Write[] = []
  const broken: unknown[] = []
  const storage: AutosaveStorage = {
    load: async () => stored,
    save: (record) =>
      new Promise<void>((resolve, reject) => {
        writes.push({ record, resolve, reject: () => reject(new Error('quota')) })
      }),
    moveToBroken: async (record) => {
      broken.push(record)
      stored = undefined
    },
  }
  return { storage, writes, broken }
}

/** A document is the chart's size and the yarn of its first cell, enough to tell charts apart. */
const format: ChartFileFormat = {
  write: () => ({ name: '', text: '' }),
  read: () => ({ ok: false, error: { code: 'not-kchart' } }),
  toDocument: (chart) => ({ width: chart.width, height: chart.height, first: chart.cells[0] }),
  readDocument: (document) => {
    const { width, height, first } = document as { width: number; height: number; first: number }
    if (typeof width !== 'number') return { ok: false, error: { code: 'not-kchart' } }
    const chart = createChart(width, height, now)
    chart.cells[0] = first
    return { ok: true, chart }
  },
}

async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function paint(session: EditorSession, column: number) {
  session.dispatch({
    type: 'pointer-down',
    cell: { row: 0, column },
    button: 'primary',
    shift: false,
  })
  session.dispatch({ type: 'pointer-up' })
}

async function setup(stored?: unknown) {
  const session = createEditorSession({ clock })
  session.dispatch({ type: 'replace-chart', chart: createChart(10, 8, now) })
  const { storage, writes, broken } = fakeStorage(stored)
  const { delay, advance } = fakeDelay()
  const autosave = createAutosave({ session, storage, format, delay })
  const events: AutosaveEvent[] = []
  autosave.subscribe((event) => events.push(event))
  await autosave.restore()
  return { session, autosave, storage, writes, broken, advance, events }
}

const chartOf = (record: AutosaveRecord) => record.document as { width: number; first: number }

describe('autosave writes', () => {
  it('writes once, 500 ms after the last edit', async () => {
    const { session, writes, advance } = await setup()

    paint(session, 0)
    advance(AUTOSAVE_DELAY - 100)
    paint(session, 1)
    advance(AUTOSAVE_DELAY - 1)
    expect(writes).toHaveLength(0)

    advance(1)
    expect(writes).toHaveLength(1)
    expect(writes[0]!.record).toEqual({
      document: { width: 10, height: 8, first: 1 },
      unsavedToFile: true,
    })
  })

  it('writes after undo and after the chart is replaced', async () => {
    const { session, writes, advance } = await setup()
    paint(session, 0)
    advance(AUTOSAVE_DELAY)
    writes[0]!.resolve()
    await settle()

    session.dispatch({ type: 'undo' })
    advance(AUTOSAVE_DELAY)
    expect(writes).toHaveLength(2)
    expect(chartOf(writes[1]!.record).first).toBe(0)
    writes[1]!.resolve()
    await settle()

    session.dispatch({ type: 'replace-chart', chart: createChart(4, 2, now) })
    advance(AUTOSAVE_DELAY)
    expect(writes).toHaveLength(3)
    expect(chartOf(writes[2]!.record).width).toBe(4)
  })

  it('writes when saving to a file clears the mark, and not for other state changes', async () => {
    const { session, writes, advance } = await setup()
    paint(session, 0)
    advance(AUTOSAVE_DELAY)
    writes[0]!.resolve()
    await settle()

    session.dispatch({ type: 'select-tool', tool: 'eraser' })
    session.dispatch({ type: 'swap-yarns' })
    advance(AUTOSAVE_DELAY)
    expect(writes).toHaveLength(1)

    session.dispatch({ type: 'mark-saved' })
    advance(AUTOSAVE_DELAY)
    expect(writes).toHaveLength(2)
    expect(writes[1]!.record.unsavedToFile).toBe(false)
  })

  it('writes at once when asked to flush, and only when there is something to write', async () => {
    const { session, autosave, writes, advance } = await setup()

    autosave.flush()
    expect(writes).toHaveLength(0)

    paint(session, 0)
    autosave.flush()
    expect(writes).toHaveLength(1)
    advance(AUTOSAVE_DELAY)
    expect(writes).toHaveLength(1)
  })

  it('writes one at a time, the next one with the latest chart', async () => {
    const { session, autosave, writes, advance } = await setup()
    paint(session, 0)
    advance(AUTOSAVE_DELAY)

    paint(session, 1)
    advance(AUTOSAVE_DELAY)
    autosave.flush()
    session.dispatch({ type: 'undo' })
    session.dispatch({ type: 'undo' })
    advance(AUTOSAVE_DELAY)
    expect(writes).toHaveLength(1)

    writes[0]!.resolve()
    await settle()
    expect(writes).toHaveLength(2)
    expect(chartOf(writes[1]!.record).first).toBe(0)
  })
})

describe('autosave status', () => {
  it('shows «saving» only for a write that takes longer than 300 ms', async () => {
    const { session, autosave, writes, advance } = await setup()
    expect(autosave.status).toBe('saved')
    paint(session, 0)
    advance(AUTOSAVE_DELAY)

    advance(SLOW_WRITE_DELAY - 1)
    expect(autosave.status).toBe('saved')
    advance(1)
    expect(autosave.status).toBe('saving')

    writes[0]!.resolve()
    await settle()
    expect(autosave.status).toBe('saved')
  })

  it('tells about a series of failed writes once, and a write that succeeds brings back «saved»', async () => {
    const { session, autosave, writes, advance, events } = await setup()

    for (const column of [0, 1, 2]) {
      paint(session, column)
      advance(AUTOSAVE_DELAY)
      writes.at(-1)!.reject()
      await settle()
      expect(autosave.status).toBe('failed')
    }
    expect(events.filter((e) => e.type === 'failed')).toHaveLength(1)

    paint(session, 3)
    advance(AUTOSAVE_DELAY + SLOW_WRITE_DELAY)
    expect(autosave.status).toBe('failed')
    writes.at(-1)!.resolve()
    await settle()
    expect(autosave.status).toBe('saved')

    paint(session, 4)
    advance(AUTOSAVE_DELAY)
    writes.at(-1)!.reject()
    await settle()
    expect(events.filter((e) => e.type === 'failed')).toHaveLength(2)
  })

  it('says closing the page loses changes only while failing with changes not in a file', async () => {
    const { session, autosave, writes, advance } = await setup()
    paint(session, 0)
    expect(autosave.unloadLoses).toBe(false)

    advance(AUTOSAVE_DELAY)
    writes[0]!.reject()
    await settle()
    expect(autosave.unloadLoses).toBe(true)

    session.dispatch({ type: 'mark-saved' })
    expect(autosave.unloadLoses).toBe(false)
  })
})

describe('autosave restore', () => {
  it('leaves the empty chart, clean, when nothing is stored', async () => {
    const { session, autosave, broken } = await setup(undefined)

    expect(session.state.chart.width).toBe(10)
    expect(session.state.unsavedToFile).toBe(false)
    expect(autosave.brokenRecord).toBeNull()
    expect(broken).toEqual([])
  })

  it('restores the chart and its mark of changes not in a file', async () => {
    const { session, writes, advance } = await setup({
      document: { width: 4, height: 2, first: 2 },
      unsavedToFile: true,
    })

    const chart: Chart = session.state.chart
    expect([chart.width, chart.height, chart.cells[0]]).toEqual([4, 2, 2])
    expect(session.state.unsavedToFile).toBe(true)
    advance(AUTOSAVE_DELAY)
    expect(writes).toHaveLength(0)
  })

  it('moves a record that fails to restore to the broken slot and keeps it for download', async () => {
    for (const stored of [
      { document: { width: 'wide' }, unsavedToFile: false },
      { document: { width: 4, height: 2, first: 0 } },
      'text',
    ]) {
      const { session, autosave, storage, broken } = await setup(stored)

      expect(broken).toEqual([stored])
      expect(await storage.load()).toBeUndefined()
      expect(autosave.brokenRecord).toEqual({ record: stored })
      expect(session.state.chart.width).toBe(10)
      expect(session.state.unsavedToFile).toBe(false)
    }
  })
})
