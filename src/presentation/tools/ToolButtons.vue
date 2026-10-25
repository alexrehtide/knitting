<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'
import type { Tool } from '../../application/editorSession'
import { shownKbds } from '../commands/registry'
import { useCommandRegistry, useCommands } from '../commands/useCommands'
import { useEditor } from '../editor/useEditor'

const { t } = useI18n()
const { state, dispatch } = useEditor()
const registry = useCommandRegistry()

const tools: readonly { tool: Tool; icon: string; code: string }[] = [
  { tool: 'brush', icon: 'i-lucide-brush', code: 'KeyB' },
  { tool: 'eraser', icon: 'i-lucide-eraser', code: 'KeyE' },
  { tool: 'eyedropper', icon: 'i-lucide-pipette', code: 'KeyI' },
]

const select = (tool: Tool) => dispatch({ type: 'select-tool', tool })

// The session ignores a tool change during a gesture by itself.
useCommands(
  tools.map(({ tool, code }) => ({
    id: `tool.${tool}`,
    label: `tool.${tool}`,
    keys: [{ code }],
    run: () => select(tool),
  })),
)

function kbds(tool: Tool) {
  const command = registry.get(`tool.${tool}`)
  return command ? shownKbds(command)[0] : undefined
}
</script>

<template>
  <UTooltip
    v-for="{ tool, icon } in tools"
    :key="tool"
    :text="t(`tool.${tool}`)"
    :kbds="kbds(tool)"
    :content="{ side: 'right' }"
  >
    <UButton
      :icon="icon"
      :aria-label="t(`tool.${tool}`)"
      :aria-pressed="state.activeTool === tool"
      :color="state.activeTool === tool ? 'primary' : 'neutral'"
      :variant="state.activeTool === tool ? 'soft' : 'ghost'"
      square
      @click="select(tool)"
    />
  </UTooltip>
</template>
