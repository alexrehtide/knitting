/** Runs `callback` after `ms`; the returned function cancels it. A fake adapter in tests. */
export type Delay = (callback: () => void, ms: number) => () => void
