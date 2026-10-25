// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindingKbds, createCommandRegistry, type Command, type CommandRegistry } from './registry'

function command(overrides: Partial<Command> = {}): Command {
  return {
    id: 'edit.undo',
    label: 'menu.edit.undo',
    keys: [{ code: 'KeyZ', ctrl: true }],
    run: vi.fn(),
    ...overrides,
  }
}

function press(init: KeyboardEventInit, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

const listeners: CommandRegistry['handleKeyDown'][] = []

function listen(registry: CommandRegistry) {
  document.addEventListener('keydown', registry.handleKeyDown)
  listeners.push(registry.handleKeyDown)
}

afterEach(() => {
  for (const listener of listeners.splice(0)) document.removeEventListener('keydown', listener)
  document.body.innerHTML = ''
})

describe('command registry', () => {
  it('runs the command whose code and modifiers match the event', () => {
    const registry = createCommandRegistry()
    const undo = command()
    registry.register(undo)
    listen(registry)

    const event = press({ code: 'KeyZ', key: 'z', ctrlKey: true })

    expect(undo.run).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('matches by code, so KeyZ works in the Russian layout', () => {
    const registry = createCommandRegistry()
    registry.register(command())

    expect(
      registry.find(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'я', ctrlKey: true }))?.id,
    ).toBe('edit.undo')
  })

  it('treats Cmd as Ctrl', () => {
    const registry = createCommandRegistry()
    registry.register(command())

    expect(registry.find(new KeyboardEvent('keydown', { code: 'KeyZ', metaKey: true }))?.id).toBe(
      'edit.undo',
    )
  })

  it('requires the modifiers to match exactly', () => {
    const registry = createCommandRegistry()
    registry.register(command())
    registry.register(
      command({ id: 'edit.redo', keys: [{ code: 'KeyZ', ctrl: true, shift: true }] }),
    )

    expect(registry.find(new KeyboardEvent('keydown', { code: 'KeyZ' }))).toBeUndefined()
    expect(
      registry.find(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: true }))
        ?.id,
    ).toBe('edit.redo')
    expect(
      registry.find(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, altKey: true })),
    ).toBeUndefined()
  })

  it('ignores an event from a text field', () => {
    const registry = createCommandRegistry()
    const undo = command()
    registry.register(undo)
    listen(registry)
    const input = document.createElement('input')
    document.body.append(input)

    const event = press({ code: 'KeyZ', ctrlKey: true }, input)

    expect(undo.run).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('is silent while a dialog or a menu is open', () => {
    const registry = createCommandRegistry()
    const undo = command()
    registry.register(undo)
    listen(registry)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)

    press({ code: 'KeyZ', ctrlKey: true })
    dialog.setAttribute('role', 'menu')
    press({ code: 'KeyZ', ctrlKey: true })

    expect(undo.run).not.toHaveBeenCalled()
  })

  it('matches a character binding by key, whichever key types it', () => {
    const registry = createCommandRegistry()
    registry.register(command({ id: 'help.shortcuts', keys: [{ key: '?' }] }))

    // US layout: Shift+Slash; Russian layout: Shift+Digit7.
    for (const code of ['Slash', 'Digit7'])
      expect(
        registry.find(new KeyboardEvent('keydown', { code, key: '?', shiftKey: true }))?.id,
      ).toBe('help.shortcuts')
    expect(
      registry.find(new KeyboardEvent('keydown', { code: 'Slash', key: '?', ctrlKey: true })),
    ).toBeUndefined()
  })

  it('leaves the key to an open dialog', () => {
    const registry = createCommandRegistry()
    const nextMode = command({ id: 'view.nextMode', keys: [{ code: 'Tab' }] })
    registry.register(nextMode)
    listen(registry)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)

    const event = press({ code: 'Tab' })

    expect(nextMode.run).not.toHaveBeenCalled()
    // Tab moves focus between the dialog's controls.
    expect(event.defaultPrevented).toBe(false)
  })

  it('wakes up as soon as the overlay starts closing', () => {
    const registry = createCommandRegistry()
    const undo = command()
    registry.register(undo)
    listen(registry)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.dataset.state = 'closed'
    document.body.append(dialog)

    press({ code: 'KeyZ', ctrlKey: true })

    expect(undo.run).toHaveBeenCalledOnce()
  })

  it('swallows the key of a muted command', () => {
    const registry = createCommandRegistry()
    const undo = command()
    registry.register(undo)
    listen(registry)
    registry.mute(() => true)

    const event = press({ code: 'KeyZ', ctrlKey: true })

    expect(undo.run).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('skips a disabled command', () => {
    const registry = createCommandRegistry()
    registry.register(command({ enabled: () => false }))

    expect(registry.find(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true }))).toBe(
      undefined,
    )
  })

  it('mutes the commands a gesture asks for until it releases them', () => {
    const registry = createCommandRegistry()
    registry.register(command())
    registry.register(command({ id: 'view.fit', keys: [{ code: 'Digit0', ctrl: true }] }))
    const undo = new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true })
    const fit = new KeyboardEvent('keydown', { code: 'Digit0', ctrlKey: true })

    const release = registry.mute((c) => c.id.startsWith('edit.'))

    expect(registry.find(undo)).toBeUndefined()
    expect(registry.find(fit)?.id).toBe('view.fit')
    release()
    expect(registry.find(undo)?.id).toBe('edit.undo')
  })

  it('forgets a command once it is unregistered', () => {
    const registry = createCommandRegistry()
    const unregister = registry.register(command())

    unregister()

    expect(registry.get('edit.undo')).toBeUndefined()
    expect(registry.list()).toEqual([])
  })
})

describe('bindingKbds', () => {
  it('names the keys for UKbd', () => {
    expect(bindingKbds({ code: 'Digit0', ctrl: true })).toEqual(['meta', '0'])
    expect(bindingKbds({ code: 'KeyZ', ctrl: true, shift: true })).toEqual(['meta', 'shift', 'Z'])
    expect(bindingKbds({ code: 'Equal', ctrl: true })).toEqual(['meta', '='])
    expect(bindingKbds({ code: 'Minus', alt: true })).toEqual(['alt', '-'])
  })

  it('shows a character binding as the character', () => {
    expect(bindingKbds({ key: '?' })).toEqual(['?'])
  })

  it('prefers the shown keys of a binding', () => {
    expect(bindingKbds({ code: 'Numpad0', ctrl: true, kbds: ['meta', 'Num 0'] })).toEqual([
      'meta',
      'Num 0',
    ])
  })
})
