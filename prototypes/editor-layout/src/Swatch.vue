<script setup>
// ПРОТОТИП. Образец нити: цвет + значок узора.
import { computed } from 'vue'
import { GLYPHS, inkFor } from './patterns.js'
const props = defineProps({ yarn: Object, size: { type: Number, default: 24 }, active: Boolean })
const ch = computed(() => (props.yarn.glyph == null ? '' : GLYPHS[props.yarn.glyph].ch))
</script>
<template>
  <span class="inline-flex shrink-0 items-center justify-center rounded-sm border border-black/20 font-bold leading-none"
    :class="active ? 'ring-2 ring-primary ring-offset-1 ring-offset-default' : ''"
    :style="{ width: size + 'px', height: size + 'px', background: yarn.color, color: inkFor(yarn.color), fontSize: size * 0.55 + 'px' }">{{ ch }}</span>
</template>
