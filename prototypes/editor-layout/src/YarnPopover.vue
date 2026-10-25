<script setup>
// ПРОТОТИП. Поповер редактора нити. Режим защиты холста задаётся в отладочной панели.
import { ref } from 'vue'
import { state, log } from './state.js'
import YarnEditor from './YarnEditor.vue'
defineProps({ id: Number, side: { type: String, default: 'left' } })
const open = ref(false)
function onOpen(v) {
  open.value = v
  state.popoverOpen = v
  if (!v) state.popoverClosedAt = performance.now()
  log(v ? 'поповер нити открыт' : 'поповер нити закрыт')
}
</script>
<template>
  <UPopover :open="open" :modal="state.popoverGuard === 'modal'" :content="{ side, align: 'start' }" @update:open="onOpen">
    <slot />
    <template #content><YarnEditor :id="id" compact /></template>
  </UPopover>
</template>
