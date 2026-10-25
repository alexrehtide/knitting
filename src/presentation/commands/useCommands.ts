import {
  computed,
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  provide,
  type InjectionKey,
} from 'vue'
import { useI18n } from 'vue-i18n'
import type { DropdownMenuItem } from '@nuxt/ui/components/DropdownMenu.vue'
import { injectStrict } from '../editor/injection'
import { createCommandRegistry, shownKbds, type Command, type CommandRegistry } from './registry'

const commandRegistryKey: InjectionKey<CommandRegistry> = Symbol('commandRegistry')

/** Creates the registry for the app and listens to the keyboard for it. */
export function provideCommands() {
  const registry = createCommandRegistry()
  provide(commandRegistryKey, registry)
  onMounted(() => window.addEventListener('keydown', registry.handleKeyDown))
  onBeforeUnmount(() => window.removeEventListener('keydown', registry.handleKeyDown))
  return registry
}

export function useCommandRegistry() {
  return injectStrict(commandRegistryKey)
}

/** Registers commands for as long as the calling component lives. */
export function useCommands(commands: readonly Command[]) {
  const registry = useCommandRegistry()
  const unregister = commands.map((command) => registry.register(command))
  onScopeDispose(() => unregister.forEach((fn) => fn()))
}

/** Menu items for registered commands, with their keys from the registry. */
export function useCommandMenuItems(ids: readonly string[]) {
  const registry = useCommandRegistry()
  const { t } = useI18n()
  return computed<DropdownMenuItem[]>(() =>
    ids.flatMap((id) => {
      const command = registry.get(id)
      if (!command) return []
      return [
        {
          label: t(command.label),
          kbds: shownKbds(command)[0],
          disabled: !registry.isAvailable(command),
          onSelect: command.run,
        },
      ]
    }),
  )
}
