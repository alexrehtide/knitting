<script setup>
// ПРОТОТИП. Редактор одной нити: цвет, hex, узор, имя, действия.
import { computed } from 'vue'
import { state, yarnById, numberOf, counts, hasClash, glyphUsers, requestDelete, requestReplaceAll } from './state.js'
import { GLYPHS } from './patterns.js'
import Swatch from './Swatch.vue'
const props = defineProps({ id: Number, compact: Boolean })
const y = computed(() => yarnById(props.id))
const hex = computed({
  get: () => y.value.color,
  set: v => { if (/^#[0-9a-f]{6}$/i.test(v)) y.value.color = v.toLowerCase() },
})
</script>
<template>
  <div v-if="y" class="flex flex-col gap-3" :class="compact ? 'w-72 p-3' : ''">
    <div class="flex items-center gap-2">
      <Swatch :yarn="y" :size="28" />
      <div class="font-medium">Нить {{ numberOf(y.id) }}</div>
      <UBadge color="neutral" variant="soft" class="ml-auto">{{ counts.get(y.id) || 0 }} петель</UBadge>
    </div>
    <UColorPicker v-model="y.color" format="hex" size="sm" class="self-center" />
    <UFormField label="Hex" size="sm">
      <UInput :model-value="hex" class="w-full font-mono" @update:model-value="hex = $event" />
    </UFormField>
    <UFormField label="Узор заливки" size="sm">
      <div class="grid grid-cols-9 gap-1">
        <UTooltip text="Без узора">
          <button class="flex h-7 items-center justify-center rounded border text-xs"
            :class="y.glyph == null ? 'border-primary bg-primary/10' : 'border-default'" @click="y.glyph = null">∅</button>
        </UTooltip>
        <UTooltip v-for="(g, i) in GLYPHS" :key="i" :text="g.name + (glyphUsers.get(i) && y.glyph !== i ? ` — уже у ${glyphUsers.get(i)} нит.` : '')">
          <button class="relative flex h-7 items-center justify-center rounded border font-bold"
            :class="y.glyph === i ? 'border-primary bg-primary/10' : 'border-default'" @click="y.glyph = i">
            {{ g.ch }}
            <span v-if="glyphUsers.get(i) && y.glyph !== i" class="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-muted" />
          </button>
        </UTooltip>
      </div>
    </UFormField>
    <UAlert v-if="hasClash(y)" color="warning" variant="soft" icon="i-lucide-triangle-alert" size="sm"
      :title="`Узор «${GLYPHS[y.glyph].ch}» есть ещё у ${glyphUsers.get(y.glyph) - 1} нит.`"
      description="На ч/б печати эти нити будут неразличимы." />
    <UFormField label="Имя / артикул" size="sm">
      <UInput v-model="y.name" placeholder="необязательно" class="w-full" />
    </UFormField>
    <div class="flex gap-2">
      <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-replace" label="Заменить во всей схеме…" @click="requestReplaceAll(y.id)" />
      <UButton size="sm" color="error" variant="ghost" icon="i-lucide-trash-2" label="Удалить" class="ml-auto" @click="requestDelete(y.id)" />
    </div>
  </div>
</template>
