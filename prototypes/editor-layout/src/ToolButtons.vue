<script setup>
import { state, TOOLS } from './state.js'
defineProps({ orientation: { type: String, default: 'horizontal' }, size: { type: String, default: 'md' } })
</script>
<template>
  <UFieldGroup :orientation="orientation" :size="size">
    <UTooltip v-for="t in TOOLS" :key="t.id" :text="t.label" :kbds="[t.key]" :content="{ side: orientation === 'vertical' ? 'right' : 'bottom' }">
      <UButton :icon="t.icon" square color="neutral" variant="outline" :active="state.tool === t.id"
        active-color="primary" active-variant="solid" @click="state.tool = t.id" />
    </UTooltip>
  </UFieldGroup>
</template>
