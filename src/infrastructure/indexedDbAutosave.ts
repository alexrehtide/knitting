import type { AutosaveStorage } from '../application/autosave'

/** The database, its one store and the keys of the record and of the record that failed to restore. */
export const AUTOSAVE_DATABASE = 'knitting'
export const AUTOSAVE_STORE = 'autosave'
export const AUTOSAVE_KEY = 'autosave'
export const AUTOSAVE_BROKEN_KEY = 'autosave-broken'

/** The autosave in IndexedDB; a failed open is tried again on the next call. */
export function createIndexedDbAutosave(): AutosaveStorage {
  let database: Promise<IDBDatabase> | null = null

  function open() {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(AUTOSAVE_DATABASE, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(AUTOSAVE_STORE)
      request.onsuccess = () => {
        // The browser may close it, such as when site data is cleared.
        request.result.onclose = () => (database = null)
        resolve(request.result)
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB open is blocked'))
    }).catch((error: unknown) => {
      database = null
      throw error
    })
    return database
  }

  async function get(key: string) {
    const transaction = (await open()).transaction(AUTOSAVE_STORE, 'readonly')
    const request = transaction.objectStore(AUTOSAVE_STORE).get(key)
    return new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Writes in one transaction, resolving once it is committed: a quota error only shows as its abort.
   * `undefined` deletes the key.
   */
  async function put(values: Record<string, unknown>) {
    const transaction = (await open()).transaction(AUTOSAVE_STORE, 'readwrite')
    const store = transaction.objectStore(AUTOSAVE_STORE)
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) store.delete(key)
      else store.put(value, key)
    }
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted'))
      transaction.onerror = () => reject(transaction.error)
    })
  }

  return {
    load: () => get(AUTOSAVE_KEY),
    save: (record) => put({ [AUTOSAVE_KEY]: record }),
    moveToBroken: (record) => put({ [AUTOSAVE_BROKEN_KEY]: record, [AUTOSAVE_KEY]: undefined }),
  }
}
