import type { ChartFileFormat } from './chartFile'
import type { Delay } from './delay'
import type { EditorSession } from './editorSession'

/** How long after the last change the chart is written (docs/spec.md, «Автосохранение»). */
export const AUTOSAVE_DELAY = 500

/** A write that takes longer than this shows «сохраняется…». */
export const SLOW_WRITE_DELAY = 300

/** What the browser keeps: the chart as a `.kchart` document and whether it has changes not in a file. */
export interface AutosaveRecord {
  readonly document: object
  readonly unsavedToFile: boolean
}

/** The browser storage of the autosave: one record, and a slot for a record that failed to restore. */
export interface AutosaveStorage {
  /** The stored record as it is, or `undefined` when there is none. */
  load(): Promise<unknown>
  save(record: AutosaveRecord): Promise<void>
  /** Moves a record that failed to restore to the `autosave-broken` slot, over the one there. */
  moveToBroken(record: unknown): Promise<void>
}

export type AutosaveStatus = 'saved' | 'saving' | 'failed'

/** `status` — the status changed; `failed` — a write failed after one that did not, once per series. */
export type AutosaveEvent = { readonly type: 'status' } | { readonly type: 'failed' }

export interface Autosave {
  readonly status: AutosaveStatus
  /** The stored record that failed to restore, for «Скачать как есть»; `null` when there was none. */
  readonly brokenRecord: { readonly record: unknown } | null
  /** Closing the page now loses changes: writes fail and the chart has changes not in a file. */
  readonly unloadLoses: boolean
  /** Loads the stored chart into the session, then starts writing its changes. Called once. */
  restore(): Promise<void>
  /** Writes the pending change at once, as when the page is hidden. */
  flush(): void
  /** Returns the function that unsubscribes the listener. */
  subscribe(listener: (event: AutosaveEvent) => void): () => void
}

/**
 * Keeps the session's chart in the browser (docs/spec.md, «Автосохранение»): a write 500 ms after the
 * last patch, replacement or change of the mark of changes not in a file; writes go one at a time, each
 * with the chart as it is when it starts.
 */
export function createAutosave({
  session,
  storage,
  format,
  delay,
}: {
  session: EditorSession
  storage: AutosaveStorage
  format: ChartFileFormat
  delay: Delay
}): Autosave {
  let status: AutosaveStatus = 'saved'
  let brokenRecord: Autosave['brokenRecord'] = null
  /** The chart has changed since the last write started. */
  let pending = false
  let writing = false
  /** A flush came during a write: the next write starts when it ends. */
  let flushAfterWrite = false
  let failing = false
  let cancelTimer: (() => void) | null = null
  /** The mark of changes not in a file as of the last change the autosave took. */
  let lastUnsavedToFile = session.state.unsavedToFile
  const listeners = new Set<(event: AutosaveEvent) => void>()

  function emit(event: AutosaveEvent) {
    for (const listener of [...listeners]) listener(event)
  }

  function setStatus(next: AutosaveStatus) {
    if (next === status) return
    status = next
    emit({ type: 'status' })
  }

  function schedule() {
    pending = true
    lastUnsavedToFile = session.state.unsavedToFile
    cancelTimer?.()
    cancelTimer = delay(flush, AUTOSAVE_DELAY)
  }

  function flush() {
    cancelTimer?.()
    cancelTimer = null
    if (!pending) return
    if (writing) flushAfterWrite = true
    else void write()
  }

  async function write() {
    writing = true
    pending = false
    flushAfterWrite = false
    // A failing autosave keeps saying so while it tries again.
    const cancelSlow = delay(() => {
      if (status !== 'failed') setStatus('saving')
    }, SLOW_WRITE_DELAY)
    const { chart, unsavedToFile } = session.state
    try {
      await storage.save({ document: format.toDocument(chart), unsavedToFile })
      failing = false
      setStatus('saved')
    } catch {
      setStatus('failed')
      if (!failing) emit({ type: 'failed' })
      failing = true
    } finally {
      cancelSlow()
      writing = false
    }
    if (flushAfterWrite) flush()
  }

  /** The stored chart, or `null` when the record does not pass the checks of an imported file. */
  function restored(record: unknown) {
    if (typeof record !== 'object' || record === null) return null
    const { document, unsavedToFile } = record as Record<string, unknown>
    if (typeof unsavedToFile !== 'boolean') return null
    const result = format.readDocument(document)
    return result.ok ? { chart: result.chart, unsavedToFile } : null
  }

  async function restore() {
    let record: unknown
    try {
      record = await storage.load()
    } catch {
      // Nothing to restore; the first write says whether the storage works.
      record = undefined
    }
    if (record !== undefined) {
      const chart = restored(record)
      if (chart) {
        session.dispatch({ type: 'replace-chart', ...chart })
      } else {
        brokenRecord = { record }
        try {
          await storage.moveToBroken(record)
        } catch {
          // The record is still offered for download.
        }
      }
    }
    lastUnsavedToFile = session.state.unsavedToFile
    session.subscribe((event) => {
      if (event.type === 'patch' || event.type === 'replaced') schedule()
      else if (event.type === 'state' && session.state.unsavedToFile !== lastUnsavedToFile)
        schedule()
    })
  }

  return {
    get status() {
      return status
    },
    get brokenRecord() {
      return brokenRecord
    },
    get unloadLoses() {
      return status === 'failed' && session.state.unsavedToFile
    },
    restore,
    flush,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
