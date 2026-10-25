import type { AutosaveLock } from '../application/autosaveLock'

/** The Web Lock of the autosave, and the channel on which a tab asks the holder to let it go. */
export const AUTOSAVE_LOCK = 'knitting-autosave'

/**
 * The lock of the autosave as a Web Lock. A takeover is a message to the holding tab and a request
 * queued behind its lock: the holder lets go once it has written, and the request gets the lock then.
 */
export function createWebLockAutosave(): AutosaveLock {
  const channel = new BroadcastChannel(AUTOSAVE_LOCK)
  /** Lets the lock go; set while this tab holds it. */
  let letGo: (() => void) | null = null
  let release: () => Promise<void> = async () => {}

  /** Keeps the lock until `letGo`. */
  function hold() {
    return new Promise<void>((resolve) => (letGo = resolve))
  }

  channel.onmessage = async () => {
    if (!letGo) return
    const done = letGo
    letGo = null
    try {
      await release()
    } finally {
      done()
    }
  }

  return {
    tryAcquire: () =>
      new Promise<boolean>((resolve, reject) => {
        navigator.locks
          .request(AUTOSAVE_LOCK, { ifAvailable: true }, (lock) => {
            resolve(lock !== null)
            return lock ? hold() : undefined
          })
          .catch(reject)
      }),
    takeOver: () =>
      new Promise<void>((resolve, reject) => {
        // Queued before the holder gets the message, so no other tab comes in between.
        navigator.locks
          .request(AUTOSAVE_LOCK, () => {
            resolve()
            return hold()
          })
          .catch(reject)
        channel.postMessage('take-over')
      }),
    onTakeOver: (handler) => (release = handler),
  }
}
