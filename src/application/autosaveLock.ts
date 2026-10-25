/**
 * The lock of the autosave: one tab of the editor at a time holds it, and only that tab writes
 * (docs/spec.md, «Автосохранение», «Несколько вкладок»).
 */
export interface AutosaveLock {
  /** Takes the lock when no tab holds it; resolves whether it did. */
  tryAcquire(): Promise<boolean>
  /** Asks the tab that holds the lock to let it go; resolves once this tab holds it. */
  takeOver(): Promise<void>
  /** What this tab does when another one takes the lock over: it lets go once `release` resolves. */
  onTakeOver(release: () => Promise<void>): void
}
