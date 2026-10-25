<script setup>
// ПРОТОТИП. Вариант A «Классика»: строка меню сверху, инструменты слева,
// справа панель с вкладками «Палитра» (список) / «Схема» (свойства), статус-бар снизу.
import { ref } from 'vue'
import { state, numberOf, counts, hasClash, clashCount, selectYarn, addYarn } from './state.js'
import { fileItems, editItems, viewItems, helpItems } from './menu.js'
import ChartCanvas from './ChartCanvas.vue'
import ToolButtons from './ToolButtons.vue'
import ModeButtons from './ModeButtons.vue'
import StatusBar from './StatusBar.vue'
import Swatch from './Swatch.vue'
import YarnPopover from './YarnPopover.vue'
import PropertiesForm from './PropertiesForm.vue'
defineOptions({ title: 'Классика' })
const tab = ref('palette')
</script>

<template>
  <div class="flex h-full flex-col bg-default">
    <header class="flex h-11 items-center gap-1 border-b border-default px-2">
      <UIcon name="i-lucide-grid-3x3" class="mx-1 size-5 text-primary" />
      <UDropdownMenu :items="fileItems()"><UButton label="Файл" color="neutral" variant="ghost" size="sm" /></UDropdownMenu>
      <UDropdownMenu :items="editItems()"><UButton label="Правка" color="neutral" variant="ghost" size="sm" /></UDropdownMenu>
      <UDropdownMenu :items="viewItems()"><UButton label="Вид" color="neutral" variant="ghost" size="sm" /></UDropdownMenu>
      <UDropdownMenu :items="helpItems()"><UButton label="Справка" color="neutral" variant="ghost" size="sm" /></UDropdownMenu>
      <div class="mx-auto truncate text-sm font-medium">{{ state.chart.name }}<span v-if="state.dirty" class="text-muted"> •</span></div>
      <ModeButtons size="sm" />
    </header>

    <div class="flex min-h-0 flex-1">
      <aside class="flex w-12 flex-col items-center gap-3 border-r border-default py-2">
        <ToolButtons orientation="vertical" />
        <div class="mt-auto flex flex-col items-center gap-1">
          <UTooltip text="Две последние нити" :kbds="['X']" :content="{ side: 'right' }">
            <button class="relative h-10 w-10" @click="selectYarn(state.previous)">
              <Swatch v-if="state.palette.find(y => y.id === state.previous)" :yarn="state.palette.find(y => y.id === state.previous)" :size="22" class="absolute bottom-0 right-0" />
              <Swatch v-if="state.palette.find(y => y.id === state.current)" :yarn="state.palette.find(y => y.id === state.current)" :size="26" class="absolute left-0 top-0 shadow" />
            </button>
          </UTooltip>
        </div>
      </aside>

      <main class="min-w-0 flex-1"><ChartCanvas /></main>

      <aside class="flex w-80 flex-col border-l border-default">
        <UTabs v-model="tab" :items="[{ label: 'Палитра', value: 'palette', icon: 'i-lucide-palette', badge: clashCount ? { label: '!', color: 'warning' } : undefined }, { label: 'Схема', value: 'props', icon: 'i-lucide-settings-2' }]"
          variant="link" size="sm" :content="false" class="px-2 pt-1" />
        <div v-if="tab === 'palette'" class="flex min-h-0 flex-1 flex-col">
          <UAlert v-if="clashCount" class="mx-2 mt-2" color="warning" variant="soft" icon="i-lucide-triangle-alert" size="sm"
            :title="`У ${clashCount} нитей совпадают узоры`" description="На ч/б печати их не различить. Нажмите на образец, чтобы сменить узор." />
          <div class="min-h-0 flex-1 overflow-y-auto p-1">
            <div v-for="y in state.palette" :key="y.id"
              class="group flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm"
              :class="state.current === y.id ? 'bg-primary/10' : 'hover:bg-elevated'" @click="selectYarn(y.id)">
              <span class="w-5 text-right text-xs tabular-nums" :class="numberOf(y.id) <= 9 ? 'font-semibold' : 'text-muted'">{{ numberOf(y.id) }}</span>
              <YarnPopover :id="y.id" side="left">
                <button @click.stop><Swatch :yarn="y" :size="22" :active="state.current === y.id" /></button>
              </YarnPopover>
              <span class="min-w-0 flex-1 truncate" :class="y.name ? '' : 'text-dimmed italic'">{{ y.name || 'без имени' }}</span>
              <UIcon v-if="hasClash(y)" name="i-lucide-triangle-alert" class="text-warning" />
              <span class="text-xs tabular-nums text-muted">{{ counts.get(y.id) || 0 }}</span>
              <UIcon name="i-lucide-grip-vertical" class="cursor-grab text-dimmed opacity-0 group-hover:opacity-100" />
            </div>
          </div>
          <div class="border-t border-default p-2">
            <UButton block icon="i-lucide-plus" label="Добавить нить" color="neutral" variant="outline" size="sm" @click="addYarn" />
          </div>
        </div>
        <div v-else class="min-h-0 flex-1 overflow-y-auto p-3">
          <PropertiesForm />
          <UButton class="mt-4" block icon="i-lucide-scaling" label="Изменить размер…" color="neutral" variant="outline" @click="state.dialog = 'resize'" />
        </div>
      </aside>
    </div>

    <footer class="h-7 border-t border-default px-3 leading-7"><StatusBar /></footer>
  </div>
</template>
