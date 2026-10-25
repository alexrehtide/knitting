<script setup>
// ПРОТОТИП. Свойства схемы.
import { computed } from 'vue'
import { state } from './state.js'
const c = state.chart
const autoAspect = computed(() => (c.gauge.rows / c.gauge.stitches).toFixed(2).replace('.', ','))
</script>
<template>
  <div class="flex flex-col gap-3">
    <UFormField label="Название"><UInput v-model="c.name" class="w-full" /></UFormField>
    <UFormField label="Заметки"><UTextarea v-model="c.notes" :rows="3" autoresize class="w-full" /></UFormField>
    <UFormField label="Плотность на 10 см" description="петель × рядов">
      <div class="flex items-center gap-2">
        <UInputNumber v-model="c.gauge.stitches" :min="1" :max="99" locale="ru" class="w-28" />
        <span class="text-muted">×</span>
        <UInputNumber v-model="c.gauge.rows" :min="1" :max="99" locale="ru" class="w-28" />
      </div>
    </UFormField>
    <UFormField label="Пропорция клетки (ширина : высота)">
      <div class="flex flex-col gap-2">
        <USwitch v-model="c.aspectAuto" :label="`Из плотности — ${autoAspect} : 1`" />
        <UInputNumber v-if="!c.aspectAuto" v-model="c.aspect" :min="0.25" :max="4" :step="0.05" locale="ru"
          :format-options="{ minimumFractionDigits: 2 }" class="w-36" />
      </div>
    </UFormField>
    <UFormField label="Нумерация рядов">
      <UFieldGroup size="sm">
        <UButton label="Снизу вверх" icon="i-lucide-arrow-up" color="neutral" variant="outline" :active="c.rowsFrom === 'bottom'" active-variant="soft" active-color="primary" @click="c.rowsFrom = 'bottom'" />
        <UButton label="Сверху вниз" icon="i-lucide-arrow-down" color="neutral" variant="outline" :active="c.rowsFrom === 'top'" active-variant="soft" active-color="primary" @click="c.rowsFrom = 'top'" />
      </UFieldGroup>
    </UFormField>
    <UFormField label="Нумерация петель">
      <UFieldGroup size="sm">
        <UButton label="Справа налево" icon="i-lucide-arrow-left" color="neutral" variant="outline" :active="c.stitchesFrom === 'right'" active-variant="soft" active-color="primary" @click="c.stitchesFrom = 'right'" />
        <UButton label="Слева направо" icon="i-lucide-arrow-right" color="neutral" variant="outline" :active="c.stitchesFrom === 'left'" active-variant="soft" active-color="primary" @click="c.stitchesFrom = 'left'" />
      </UFieldGroup>
    </UFormField>
    <UFormField label="Шаг выделения" description="каждая N-я линия жирнее">
      <UInputNumber v-model="c.majorStep" :min="2" :max="50" class="w-28" />
    </UFormField>
    <div class="text-xs text-muted">Создана {{ c.created }} · изменена {{ c.modified }}</div>
  </div>
</template>
