<script setup>
// ПРОТОТИП. Вариант B «Холст на весь экран»: всё плавает поверх холста.
// Меню-гамбургер слева сверху, инструменты — пилюля по центру сверху,
// палитра — док внизу, свойства — выезжающая панель справа.
import { ref, computed } from 'vue'
import { state, numberOf, clashCount, hasClash, selectYarn, addYarn } from './state.js'
import { fileItems, editItems, viewItems, helpItems } from './menu.js'
import ChartCanvas from './ChartCanvas.vue'
import ToolButtons from './ToolButtons.vue'
import ModeButtons from './ModeButtons.vue'
import StatusBar from './StatusBar.vue'
import Swatch from './Swatch.vue'
import YarnPopover from './YarnPopover.vue'
import PropertiesForm from './PropertiesForm.vue'
defineOptions({ title: 'Холст на весь экран' })
const propsOpen = ref(false)
const allMenu = computed(() => [
  ...fileItems(),
  [{ label: 'Правка', icon: 'i-lucide-pencil', children: editItems() }, { label: 'Вид', icon: 'i-lucide-eye', children: viewItems() }],
  ...helpItems(),
])
</script>

<template>
  <div class="relative h-full bg-default">
    <ChartCanvas />

    <div class="absolute left-10 top-9 flex items-center gap-2 rounded-lg bg-default/90 p-1 shadow ring ring-default backdrop-blur">
      <UDropdownMenu :items="allMenu" :content="{ align: 'start' }"><UButton icon="i-lucide-menu" color="neutral" variant="ghost" square /></UDropdownMenu>
      <div class="pr-2 text-sm font-medium">{{ state.chart.name }}<span v-if="state.dirty" class="text-warning"> •</span></div>
    </div>

    <div class="absolute left-1/2 top-9 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-default/90 p-1 shadow ring ring-default backdrop-blur">
      <ToolButtons />
      <USeparator orientation="vertical" class="h-6" />
      <ModeButtons :labels="false" />
    </div>

    <div class="absolute right-3 top-9 flex gap-1 rounded-lg bg-default/90 p-1 shadow ring ring-default backdrop-blur">
      <UTooltip text="Вписать в окно" :kbds="['ctrl', '0']"><UButton icon="i-lucide-maximize" color="neutral" variant="ghost" square @click="dispatchEvent(new Event('kchart:fit'))" /></UTooltip>
      <UTooltip text="Свойства схемы"><UButton icon="i-lucide-settings-2" color="neutral" variant="ghost" square @click="propsOpen = true" /></UTooltip>
      <UTooltip text="Экспорт PDF" :kbds="['ctrl', 'P']"><UButton icon="i-lucide-printer" color="neutral" variant="ghost" square @click="state.dialog = 'pdf'" /></UTooltip>
    </div>

    <div class="absolute bottom-14 right-3 rounded-md bg-default/90 px-2 py-1 shadow ring ring-default backdrop-blur"><StatusBar /></div>

    <div class="absolute bottom-3 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1 rounded-xl bg-default/95 p-1.5 shadow-lg ring ring-default backdrop-blur">
      <UTooltip v-if="clashCount" :text="`У ${clashCount} нитей совпадают узоры — на ч/б печати их не различить`">
        <UIcon name="i-lucide-triangle-alert" class="mx-1 size-5 shrink-0 text-warning" />
      </UTooltip>
      <div class="flex gap-1 overflow-x-auto pb-0.5">
        <div v-for="y in state.palette" :key="y.id" class="relative shrink-0">
          <YarnPopover v-if="state.current === y.id" :id="y.id" side="top">
            <button class="block" title="Нажмите ещё раз, чтобы изменить нить"><Swatch :yarn="y" :size="30" active /></button>
          </YarnPopover>
          <UTooltip v-else :text="`${numberOf(y.id)}${y.name ? ' · ' + y.name : ''}`" :kbds="numberOf(y.id) <= 9 ? [String(numberOf(y.id))] : undefined">
            <button class="block" @click="selectYarn(y.id)"><Swatch :yarn="y" :size="30" /></button>
          </UTooltip>
          <span class="pointer-events-none absolute -top-1 left-0.5 rounded bg-default px-0.5 text-[9px] font-semibold tabular-nums leading-tight ring ring-default">{{ numberOf(y.id) }}</span>
          <span v-if="hasClash(y)" class="pointer-events-none absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning" />
        </div>
      </div>
      <UTooltip text="Добавить нить"><UButton icon="i-lucide-plus" color="neutral" variant="ghost" square @click="addYarn" /></UTooltip>
    </div>

    <USlideover v-model:open="propsOpen" title="Свойства схемы" :overlay="false">
      <template #body>
        <PropertiesForm />
        <UButton class="mt-4" block icon="i-lucide-scaling" label="Изменить размер…" color="neutral" variant="outline" @click="state.dialog = 'resize'" />
      </template>
    </USlideover>
  </div>
</template>
