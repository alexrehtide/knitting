<script setup lang="ts">
// Colour only: fill patterns come to the swatch in stage 2.
const { color } = defineProps<{ color: string }>()
</script>

<template>
  <span
    class="inline-block shrink-0 rounded-sm ring-1 ring-black/25 ring-inset"
    :style="{ backgroundColor: color }"
  />
</template>
