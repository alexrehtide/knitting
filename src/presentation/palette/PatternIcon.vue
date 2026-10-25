<script setup lang="ts">
// The canvas icon (src/domain/fillPattern.ts) as SVG in the unit square, drawn in `currentColor`.
import { computed } from 'vue'
import { PATTERN_SHAPES, type FillPattern, type PatternPoint } from '../../domain/fillPattern'

const { pattern } = defineProps<{ pattern: FillPattern }>()

const primitives = computed(() => PATTERN_SHAPES[pattern])
const points = (list: readonly PatternPoint[]) => list.map(([x, y]) => `${x},${y}`).join(' ')
</script>

<template>
  <svg
    viewBox="0 0 1 1"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <template v-for="(p, i) in primitives" :key="i">
      <line
        v-if="p.kind === 'segment'"
        :x1="p.from[0]"
        :y1="p.from[1]"
        :x2="p.to[0]"
        :y2="p.to[1]"
        :stroke-width="p.width"
      />
      <circle
        v-else-if="p.kind === 'disc'"
        :cx="p.center[0]"
        :cy="p.center[1]"
        :r="p.radius"
        fill="currentColor"
        stroke="none"
      />
      <circle
        v-else-if="p.kind === 'circle'"
        :cx="p.center[0]"
        :cy="p.center[1]"
        :r="p.radius"
        :stroke-width="p.width"
      />
      <polygon
        v-else-if="p.kind === 'polygon'"
        :points="points(p.points)"
        fill="currentColor"
        stroke="none"
      />
      <polygon
        v-else-if="p.kind === 'polyline' && p.closed"
        :points="points(p.points)"
        :stroke-width="p.width"
      />
      <polyline v-else :points="points(p.points)" :stroke-width="p.width" />
    </template>
  </svg>
</template>
