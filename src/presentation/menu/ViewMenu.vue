<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import type { DropdownMenuItem } from '@nuxt/ui/components/DropdownMenu.vue'
import type { ChartView } from '../canvas/useChartView'

const { view } = defineProps<{ view: ChartView }>()

const { t } = useI18n()

const items = computed<DropdownMenuItem[]>(() => [
  { label: t('menu.view.fit'), kbds: ['ctrl', '0'], onSelect: view.fit },
  { label: t('menu.view.zoomIn'), kbds: ['ctrl', '='], onSelect: view.zoomIn },
  { label: t('menu.view.zoomOut'), kbds: ['ctrl', '-'], onSelect: view.zoomOut },
])

// A local handler until the command registry takes over the shortcuts.
const shortcuts: Record<string, () => void> = {
  Digit0: view.fit,
  Numpad0: view.fit,
  Equal: view.zoomIn,
  NumpadAdd: view.zoomIn,
  Minus: view.zoomOut,
  NumpadSubtract: view.zoomOut,
}

function onKeyDown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return
  const action = shortcuts[event.code]
  if (!action) return
  // Ctrl+= and Ctrl+- would otherwise zoom the whole page.
  event.preventDefault()
  action()
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'start' }">
    <UButton :label="t('menu.view.title')" color="neutral" variant="ghost" size="sm" />
  </UDropdownMenu>
</template>
