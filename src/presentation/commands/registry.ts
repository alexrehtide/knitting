import { shallowReactive } from 'vue'

interface KeyOptions {
  ctrl?: boolean
  alt?: boolean
  /** Keys shown instead of the bound ones. */
  kbds?: readonly string[]
  /** Kept out of menus and help, for alternatives like the numpad. */
  hidden?: boolean
}

/**
 * A key combination bound by `event.code`, so it works in any layout; `ctrl` also matches Cmd.
 * A character such as `?` sits on different keys in different layouts, so it is bound by `event.key`
 * instead, and Shift is whatever the layout needs to type it.
 */
export type KeyBinding = KeyOptions &
  ({ code: string; shift?: boolean; key?: never } | { key: string; code?: never; shift?: never })

export interface Command {
  id: string
  /** A message key of the dictionary. */
  label: string
  keys: readonly KeyBinding[]
  run: () => void
  enabled?: () => boolean
}

export type CommandRegistry = ReturnType<typeof createCommandRegistry>

// Keys typed into these belong to them.
const TEXT_FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
// Open dialogs, popovers, menus and selects own the keyboard while they are up; a closing one no longer does.
const OVERLAY = ['dialog', 'alertdialog', 'menu', 'listbox']
  .map((role) => `[role="${role}"]:not([data-state="closed"])`)
  .join(', ')

const KEY_NAMES: Record<string, string> = { Equal: '=', Minus: '-', Slash: '/' }

function matches(binding: KeyBinding, event: KeyboardEvent) {
  if (!!binding.ctrl !== (event.ctrlKey || event.metaKey) || !!binding.alt !== event.altKey)
    return false
  if (binding.key !== undefined) return binding.key === event.key
  return binding.code === event.code && !!binding.shift === event.shiftKey
}

function isTextField(target: EventTarget | null) {
  return target instanceof Element && target.closest(TEXT_FIELD) !== null
}

/** Keys of a binding as `UKbd` values; `meta` shows as Ctrl, or ⌘ on macOS. */
export function bindingKbds(binding: KeyBinding): string[] {
  if (binding.kbds) return [...binding.kbds]
  const key = binding.key ?? KEY_NAMES[binding.code] ?? binding.code.replace(/^(Key|Digit)/, '')
  return [
    ...(binding.ctrl ? ['meta'] : []),
    ...(binding.alt ? ['alt'] : []),
    ...(binding.shift ? ['shift'] : []),
    key,
  ]
}

/** Bindings shown to the user, as `UKbd` values. */
export function shownKbds(command: Command): string[][] {
  return command.keys.filter((binding) => !binding.hidden).map(bindingKbds)
}

/** The single list of keyboard commands (docs/spec.md, «Горячие клавиши»). */
export function createCommandRegistry() {
  const commands = shallowReactive(new Map<string, Command>())
  const mutes = new Set<(command: Command) => boolean>()

  function register(command: Command) {
    if (commands.has(command.id)) throw new Error(`Command ${command.id} is already registered`)
    commands.set(command.id, command)
    return () => {
      if (commands.get(command.id) === command) commands.delete(command.id)
    }
  }

  /** Enabled and not muted by a gesture. */
  function isAvailable(command: Command) {
    return (command.enabled?.() ?? true) && ![...mutes].some((muted) => muted(command))
  }

  function bound(event: KeyboardEvent) {
    for (const command of commands.values())
      if (command.keys.some((binding) => matches(binding, event))) return command
    return undefined
  }

  /** The command the event would run now. */
  function find(event: KeyboardEvent) {
    const command = bound(event)
    return command && isAvailable(command) ? command : undefined
  }

  function handleKeyDown(event: KeyboardEvent) {
    // An overlay keeps its keys, such as Tab between its controls.
    if (event.defaultPrevented || isTextField(event.target) || document.querySelector(OVERLAY))
      return
    const command = bound(event)
    if (!command) return
    // The key is the editor's even when it does nothing now: no page zoom on Ctrl+=, no focus move on Tab
    // mid-gesture.
    event.preventDefault()
    if (isAvailable(command)) command.run()
  }

  /** Mutes the commands the predicate picks (a gesture mutes tool and undo keys) until released. */
  function mute(predicate: (command: Command) => boolean) {
    mutes.add(predicate)
    return () => {
      mutes.delete(predicate)
    }
  }

  return {
    register,
    get: (id: string) => commands.get(id),
    list: () => [...commands.values()],
    isAvailable,
    find,
    handleKeyDown,
    mute,
  }
}
