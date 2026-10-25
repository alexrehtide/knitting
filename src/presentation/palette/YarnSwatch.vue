<script setup lang="ts">
// The yarn colour with its fill pattern icon, black or white by the colour as on the canvas.
import { patternInk, type FillPattern } from '../../domain/fillPattern'
import PatternIcon from './PatternIcon.vue'

const { color, pattern = null } = defineProps<{ color: string; pattern?: FillPattern | null }>()
</script>

<template>
  <span
    class="inline-block shrink-0 rounded-sm ring-1 ring-black/25 ring-inset"
    :style="{ backgroundColor: color }"
  >
    <PatternIcon
      v-if="pattern"
      :pattern="pattern"
      class="size-full"
      :class="patternInk(color) === 'white' ? 'text-white' : 'text-black'"
    />
  </span>
</template>
