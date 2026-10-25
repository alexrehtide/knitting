<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu, { type DropdownMenuItem } from '@nuxt/ui/components/DropdownMenu.vue'
import type { ChartView } from '../canvas/useChartView'
import { useCommandMenuItems, useCommands } from '../commands/useCommands'

const { view } = defineProps<{ view: ChartView }>()

const { t } = useI18n()

useCommands([
  {
    id: 'view.fit',
    label: 'menu.view.fit',
    keys: [
      { code: 'Digit0', ctrl: true },
      { code: 'Numpad0', ctrl: true, hidden: true },
    ],
    run: view.fit,
  },
  {
    id: 'view.zoomIn',
    label: 'menu.view.zoomIn',
    keys: [
      { code: 'Equal', ctrl: true },
      // Ctrl++ on layouts where + needs Shift.
      { code: 'Equal', ctrl: true, shift: true, hidden: true },
      { code: 'NumpadAdd', ctrl: true, hidden: true },
    ],
    run: view.zoomIn,
  },
  {
    id: 'view.zoomOut',
    label: 'menu.view.zoomOut',
    keys: [
      { code: 'Minus', ctrl: true },
      { code: 'NumpadSubtract', ctrl: true, hidden: true },
    ],
    run: view.zoomOut,
  },
])

const commandItems = useCommandMenuItems(['view.fit', 'view.zoomIn', 'view.zoomOut'])
const items = computed<DropdownMenuItem[][]>(() => [
  commandItems.value,
  [
    {
      label: t('menu.view.lineHighlight'),
      type: 'checkbox',
      checked: view.lineHighlight.value,
      onUpdateChecked: view.setLineHighlight,
      // Keeps the menu open, as for other checkboxes.
      onSelect: (event: Event) => event.preventDefault(),
    },
  ],
])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'start' }">
    <UButton :label="t('menu.view.title')" color="neutral" variant="ghost" size="sm" />
  </UDropdownMenu>
</template>
