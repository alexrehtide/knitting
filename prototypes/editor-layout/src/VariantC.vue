<script setup>
// ПРОТОТИП. Вариант C «Палитра-инспектор»: широкая левая панель — сетка образцов
// и редактор выбранной нити прямо в панели (без поповера). Сверху — одна панель
// с кнопками файла, инструментами и режимом. Свойства схемы — диалогом.
import { state, numberOf, clashCount, hasClash, selectYarn, addYarn, guardedReplaceChart, log } from './state.js'
import ChartCanvas from './ChartCanvas.vue'
import ToolButtons from './ToolButtons.vue'
import ModeButtons from './ModeButtons.vue'
import StatusBar from './StatusBar.vue'
import Swatch from './Swatch.vue'
import YarnEditor from './YarnEditor.vue'
defineOptions({ title: 'Палитра-инспектор' })
</script>

<template>
  <div class="flex h-full bg-default">
    <aside class="flex w-80 flex-col border-r border-default">
      <div class="flex items-center gap-2 border-b border-default p-3">
        <UIcon name="i-lucide-grid-3x3" class="size-5 text-primary" />
        <UInput v-model="state.chart.name" variant="ghost" class="flex-1 font-medium" />
      </div>
      <div class="flex items-center justify-between px-3 pt-3 text-xs font-semibold uppercase text-muted">
        Палитра · {{ state.palette.length }}
        <UButton icon="i-lucide-plus" label="Нить" size="xs" color="neutral" variant="outline" @click="addYarn" />
      </div>
      <UAlert v-if="clashCount" class="mx-3 mt-2" color="warning" variant="soft" icon="i-lucide-triangle-alert" size="sm"
        :title="`Совпадают узоры у ${clashCount} нитей`" />
      <div class="grid max-h-56 shrink-0 grid-cols-6 gap-1.5 overflow-y-auto p-3">
        <UTooltip v-for="y in state.palette" :key="y.id" :text="y.name || 'без имени'" :kbds="numberOf(y.id) <= 9 ? [String(numberOf(y.id))] : undefined">
          <button class="relative flex flex-col items-center rounded p-0.5" :class="state.current === y.id ? 'bg-primary/10' : 'hover:bg-elevated'" @click="selectYarn(y.id)">
            <Swatch :yarn="y" :size="34" :active="state.current === y.id" />
            <span class="text-[10px] tabular-nums" :class="numberOf(y.id) <= 9 ? 'font-semibold' : 'text-muted'">{{ numberOf(y.id) }}</span>
            <span v-if="hasClash(y)" class="absolute right-0 top-0 size-2 rounded-full bg-warning" />
          </button>
        </UTooltip>
      </div>
      <USeparator />
      <div class="min-h-0 flex-1 overflow-y-auto p-3"><YarnEditor :id="state.current" /></div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-center gap-2 border-b border-default px-2 py-1.5">
        <UFieldGroup size="sm">
          <UTooltip text="Новая схема" :kbds="['ctrl', 'N']"><UButton icon="i-lucide-file-plus" color="neutral" variant="outline" square @click="guardedReplaceChart('new')" /></UTooltip>
          <UTooltip text="Открыть .kchart" :kbds="['ctrl', 'O']"><UButton icon="i-lucide-folder-open" color="neutral" variant="outline" square @click="guardedReplaceChart('import')" /></UTooltip>
          <UTooltip text="Сохранить в файл .kchart" :kbds="['ctrl', 'S']"><UButton icon="i-lucide-save" color="neutral" variant="outline" square @click="state.dirty = false; log('экспорт .kchart (заглушка)')" /></UTooltip>
        </UFieldGroup>
        <UFieldGroup size="sm">
          <UButton icon="i-lucide-image" label="PNG" color="neutral" variant="outline" @click="log('экспорт PNG (заглушка)')" />
          <UButton icon="i-lucide-printer" label="PDF" color="neutral" variant="outline" @click="state.dialog = 'pdf'" />
        </UFieldGroup>
        <USeparator orientation="vertical" class="h-6" />
        <UFieldGroup size="sm">
          <UTooltip text="Отменить" :kbds="['ctrl', 'Z']"><UButton icon="i-lucide-undo-2" color="neutral" variant="ghost" square @click="log('undo (заглушка)')" /></UTooltip>
          <UTooltip text="Повторить" :kbds="['ctrl', 'shift', 'Z']"><UButton icon="i-lucide-redo-2" color="neutral" variant="ghost" square @click="log('redo (заглушка)')" /></UTooltip>
        </UFieldGroup>
        <ToolButtons size="sm" />
        <div class="ml-auto flex items-center gap-2">
          <ModeButtons size="sm" />
          <UTooltip text="Размер схемы"><UButton icon="i-lucide-scaling" size="sm" color="neutral" variant="ghost" square @click="state.dialog = 'resize'" /></UTooltip>
          <UTooltip text="Свойства схемы"><UButton icon="i-lucide-settings-2" size="sm" color="neutral" variant="ghost" square @click="state.dialog = 'props'" /></UTooltip>
          <UTooltip text="Горячие клавиши" :kbds="['?']"><UButton icon="i-lucide-keyboard" size="sm" color="neutral" variant="ghost" square @click="state.dialog = 'keys'" /></UTooltip>
        </div>
      </div>
      <main class="min-h-0 flex-1"><ChartCanvas /></main>
      <footer class="h-7 border-t border-default px-3 leading-7"><StatusBar /></footer>
    </div>
  </div>
</template>
