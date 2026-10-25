<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu, { type DropdownMenuItem } from '@nuxt/ui/components/DropdownMenu.vue'
import { useCommandMenuItems, useCommands } from '../commands/useCommands'
import { useEditor } from '../editor/useEditor'

const { t } = useI18n()
const { state, dispatch } = useEditor()

// Off during a gesture, which the session ignores them in anyway.
useCommands([
  {
    id: 'edit.undo',
    label: 'menu.edit.undo',
    keys: [{ code: 'KeyZ', ctrl: true }],
    run: () => dispatch({ type: 'undo' }),
    enabled: () => state.value.canUndo && !state.value.gestureActive,
  },
  {
    id: 'edit.redo',
    label: 'menu.edit.redo',
    keys: [
      { code: 'KeyZ', ctrl: true, shift: true },
      { code: 'KeyY', ctrl: true },
    ],
    run: () => dispatch({ type: 'redo' }),
    enabled: () => state.value.canRedo && !state.value.gestureActive,
  },
])

const commandItems = useCommandMenuItems(['edit.undo', 'edit.redo'])
const items = computed<DropdownMenuItem[][]>(() => [commandItems.value])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'start' }">
    <UButton :label="t('menu.edit.title')" color="neutral" variant="ghost" size="sm" />
  </UDropdownMenu>
</template>
