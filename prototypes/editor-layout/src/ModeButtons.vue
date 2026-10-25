<script setup>
import { state, MODES } from './state.js'
defineProps({ labels: { type: Boolean, default: true }, size: { type: String, default: 'md' } })
</script>
<template>
  <UTooltip text="Режим отображения" :kbds="['tab']">
    <UFieldGroup :size="size">
      <UButton v-for="m in MODES" :key="m.id" :icon="m.icon" :label="labels ? m.label : undefined" color="neutral" variant="outline"
        :active="state.displayMode === m.id" active-color="primary" active-variant="soft" @click="state.displayMode = m.id" />
    </UFieldGroup>
  </UTooltip>
</template>
