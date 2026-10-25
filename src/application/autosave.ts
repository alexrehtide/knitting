import type { AutosaveLock } from './autosaveLock'
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

/**
 * `status` — the status changed; `failed` — a write failed after one that did not, once per series;
 * `owner` — the tab took the lock and loaded the stored chart, or let the lock go to another tab.
 */
export type AutosaveEvent =
  { readonly type: 'status' } | { readonly type: 'failed' } | { readonly type: 'owner' }

export interface Autosave {
  readonly status: AutosaveStatus
  /** This tab holds the lock of the autosave: it has loaded the stored chart and writes its changes. */
  readonly owner: boolean
  /** The stored record that failed to restore, for «Скачать как есть»; `null` when there was none. */
  readonly brokenRecord: { readonly record: unknown } | null
  /** Closing the page now loses changes: writes fail and the chart has changes not in a file. */
  readonly unloadLoses: boolean
  /**
   * Takes the lock when no other tab holds it, loads the stored chart into the session and starts
   * writing its changes; otherwise leaves the tab without the lock and the chart unloaded. Called once.
   */
  start(): Promise<void>
  /**
   * «Работать здесь»: the tab with the lock writes its pending change and lets it go, then this tab
   * loads the stored chart and writes from now on.
   */
  takeOver(): Promise<void>
  /** Writes the pending change at once, as when the page is hidden. */
  flush(): void
  /** Returns the function that unsubscribes the listener. */
  subscribe(listener: (event: AutosaveEvent) => void): () => void
}

/**
 * Keeps the session's chart in the browser (docs/spec.md, «Автосохранение»): a write 500 ms after the
 * last patch, replacement or change of the mark of changes not in a file; writes go one at a time, each
 * with the chart as it is when it starts. Only the tab that holds the lock writes («Несколько вкладок»).
 */
export function createAutosave({
  session,
  storage,
  lock,
  format,
  delay,
}: {
  session: EditorSession
  storage: AutosaveStorage
  lock: AutosaveLock
  format: ChartFileFormat
  delay: Delay
}): Autosave {
  let status: AutosaveStatus = 'saved'
  let brokenRecord: Autosave['brokenRecord'] = null
  let owner = false
  /** Stops taking the session's changes; set while this tab holds the lock. */
  let unsubscribe: (() => void) | null = null
  /** The chart has changed since the last write started. */
  let pending = false
  let writing = false
  /** The write in progress, or the last one. */
  let lastWrite = Promise.resolve()
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
    else lastWrite = write()
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

  /** Loads the stored chart into the session, then writes its changes. */
  async function restore() {
    let record: unknown
    try {
      record = await storage.load()
    } catch {
      // Nothing to restore; the first write says whether the storage works.
      record = undefined
    }
    brokenRecord = null
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
    unsubscribe = session.subscribe((event) => {
      if (event.type === 'patch' || event.type === 'replaced') schedule()
      else if (event.type === 'state' && session.state.unsavedToFile !== lastUnsavedToFile)
        schedule()
    })
    owner = true
    emit({ type: 'owner' })
  }

  /** Another tab takes the lock over: the chart as it is now is written before the lock goes. */
  async function release() {
    owner = false
    emit({ type: 'owner' })
    // A gesture is not an edit until it ends: its cells go back, and the rollback is what gets written.
    session.dispatch({ type: 'cancel-gesture' })
    unsubscribe?.()
    unsubscribe = null
    flush()
    while (writing) await lastWrite
  }

  lock.onTakeOver(release)

  async function start() {
    if (await lock.tryAcquire()) await restore()
  }

  async function takeOver() {
    await lock.takeOver()
    await restore()
  }

  return {
    get status() {
      return status
    },
    get owner() {
      return owner
    },
    get brokenRecord() {
      return brokenRecord
    },
    get unloadLoses() {
      return status === 'failed' && session.state.unsavedToFile
    },
    start,
    takeOver,
    flush,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
