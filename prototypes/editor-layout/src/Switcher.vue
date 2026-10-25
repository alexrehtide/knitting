<script setup>
// ПРОТОТИП. Переключатель вариантов и отладочная панель проверки поповера.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { state } from './state.js'
const props = defineProps({ variants: Object })
const model = defineModel()
const keys = Object.keys(props.variants)
const showLog = ref(true)
function go(d) {
  const i = (keys.indexOf(model.value) + d + keys.length) % keys.length
  model.value = keys[i]
  const u = new URL(location.href); u.searchParams.set('variant', keys[i]); history.replaceState(null, '', u)
}
const onKey = e => {
  if (e.target.closest?.('input, textarea, [contenteditable]') || state.dialog) return
  if (e.code === 'ArrowLeft') go(-1)
  if (e.code === 'ArrowRight') go(1)
}
onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))
const GUARDS = [['none', 'без защиты'], ['modal', 'modal'], ['swallow', 'проглотить клик']]
</script>
<template>
  <div class="fixed left-1/2 top-1 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-medium text-black shadow-lg">
    <span class="uppercase tracking-wide opacity-70">прототип</span>
    <button class="px-1" @click="go(-1)">◀</button>
    <span>{{ model }} ({{ variants[model].title }})</span>
    <button class="px-1" @click="go(1)">▶</button>
    <span class="opacity-40">|</span>
    <span class="opacity-70">поповер:</span>
    <button v-for="g in GUARDS" :key="g[0]" class="rounded-full px-1.5" :class="state.popoverGuard === g[0] ? 'bg-black text-amber-300' : ''"
      @click="state.popoverGuard = g[0]">{{ g[1] }}</button>
    <span class="opacity-40">|</span>
    <button @click="showLog = !showLog">лог {{ showLog ? '▴' : '▾' }}</button>
  </div>
  <div v-if="showLog && state.log.length" class="pointer-events-none fixed left-1/2 top-8 z-50 w-96 -translate-x-1/2 rounded bg-amber-100/95 p-2 font-mono text-[11px] text-black shadow">
    <div v-for="(l, i) in state.log" :key="i" :class="i ? 'opacity-60' : ''">{{ l }}</div>
  </div>
</template>
