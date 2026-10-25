import type { Delay } from '../application/delay'

export const systemDelay: Delay = (callback, ms) => {
  const id = setTimeout(callback, ms)
  return () => clearTimeout(id)
}
