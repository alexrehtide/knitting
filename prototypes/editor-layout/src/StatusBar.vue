<script setup>
import { computed } from 'vue'
import { state, TOOLS, yarnById, numberOf, displayLabel } from './state.js'
import Swatch from './Swatch.vue'
const pos = computed(() => (state.cursor ? displayLabel(state.cursor.x, state.cursor.y) : null))
const yarn = computed(() => yarnById(state.current))
</script>
<template>
  <div class="flex items-center gap-4 text-xs text-muted tabular-nums">
    <span class="min-w-36">
      <template v-if="pos">Ряд <b class="text-default">{{ pos.row }}</b> · петля <b class="text-default">{{ pos.col }}</b></template>
      <template v-else>—</template>
    </span>
    <span>{{ state.chart.w }} × {{ state.chart.h }}</span>
    <span>{{ Math.round(state.zoom) }} px/кл.</span>
    <span>{{ TOOLS.find(t => t.id === state.tool).label }}</span>
    <span v-if="yarn" class="inline-flex items-center gap-1"><Swatch :yarn="yarn" :size="14" /> нить {{ numberOf(yarn.id) }}</span>
    <span class="ml-auto inline-flex items-center gap-1">
      <UIcon name="i-lucide-cloud-check" /> {{ state.autosave }}
    </span>
    <UTooltip v-if="state.dirty" text="Есть изменения после последнего сохранения в файл .kchart">
      <span class="inline-flex items-center gap-1 text-warning"><UIcon name="i-lucide-circle-dot" /> не в файле</span>
    </UTooltip>
  </div>
</template>
