import type { Delay } from '../application/autosave'

export const systemDelay: Delay = (callback, ms) => {
  const id = setTimeout(callback, ms)
  return () => clearTimeout(id)
}
