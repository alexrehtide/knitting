import type { AutosaveLock } from '../application/autosaveLock'

/** The Web Lock of the autosave, and the channel on which a tab asks the holder to let it go. */
export const AUTOSAVE_LOCK = 'knitting-autosave'

/**
 * How often a tab waiting for the lock asks again: the lock may have gone to another waiting tab that
 * did not hold it yet when the first ask came.
 */
const ASK_AGAIN_DELAY = 500

/**
 * The lock of the autosave as a Web Lock. A takeover is a request queued behind the holder's lock and
 * a message to the holder: the holder lets go once it has written, and the request gets the lock then.
 */
export function createWebAutosaveLock(): AutosaveLock {
  const channel = new BroadcastChannel(AUTOSAVE_LOCK)
  /** Lets the lock go; set while this tab holds it. */
  let letGo: (() => void) | null = null
  let release: () => Promise<void> = async () => {}

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

  /** Requests the lock and keeps it until `letGo`; resolves whether it got it. */
  function request(options: LockOptions) {
    return new Promise<boolean>((resolve, reject) => {
      navigator.locks
        .request(AUTOSAVE_LOCK, options, (lock) => {
          resolve(lock !== null)
          return lock ? new Promise<void>((resolve) => (letGo = resolve)) : undefined
        })
        .catch(reject)
    })
  }

  return {
    tryAcquire: () => request({ ifAvailable: true }),
    takeOver: async () => {
      // Queued before the holder gets the message, so no tab that asks later comes in between.
      const acquired = request({})
      const ask = () => channel.postMessage('take-over')
      ask()
      const asking = setInterval(ask, ASK_AGAIN_DELAY)
      try {
        await acquired
      } finally {
        clearInterval(asking)
      }
    },
    onTakeOver: (handler) => (release = handler),
  }
}
