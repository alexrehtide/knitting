<script setup>
// ПРОТОТИП, выбросить. Все диалоги редактора — общие для вариантов раскладки.
import { ref, reactive, computed, watch } from 'vue'
import { state, yarnById, numberOf, counts, applyReplace, log } from './state.js'
import Swatch from './Swatch.vue'
import PropertiesForm from './PropertiesForm.vue'
import { KEYS } from './keys.js'

const open = name => computed({
  get: () => state.dialog === name,
  set: v => { if (!v && state.dialog === name) state.dialog = null },
})
const newOpen = open('new'), resizeOpen = open('resize'), replaceOpen = open('replace')
const unsavedOpen = open('unsaved'), pdfOpen = open('pdf'), keysOpen = open('keys'), propsOpen = open('props')

// --- Новая схема
const nw = reactive({ w: 40, h: 40, st: 22, rows: 30 })
function createNew() {
  Object.assign(state.chart, { w: nw.w, h: nw.h, name: 'Без названия', notes: '', gauge: { stitches: nw.st, rows: nw.rows } })
  state.grid = new Uint16Array(nw.w * nw.h)
  state.gridVersion++; state.dirty = false; state.dialog = null
  log(`новая схема ${nw.w}×${nw.h}`)
  requestAnimationFrame(() => dispatchEvent(new Event('kchart:fit')))
}

// --- Изменение размера
const rs = reactive({ top: 0, bottom: 0, left: 0, right: 0 })
watch(resizeOpen, v => v && Object.assign(rs, { top: 0, bottom: 0, left: 0, right: 0 }))
const newW = computed(() => state.chart.w + rs.left + rs.right)
const newH = computed(() => state.chart.h + rs.top + rs.bottom)
const cropped = computed(() => {
  const { w, h } = state.chart
  let n = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const out = y < -rs.top || y >= h + rs.bottom || x < -rs.left || x >= w + rs.right
    if (out && state.grid[y * w + x]) n++
  }
  return n
})
function applyResize() {
  const { w, h } = state.chart, W = newW.value, H = newH.value
  const g = new Uint16Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = x - rs.left, sy = y - rs.top
    if (sx >= 0 && sy >= 0 && sx < w && sy < h) g[y * W + x] = state.grid[sy * w + sx]
  }
  state.grid = g; state.chart.w = W; state.chart.h = H
  state.gridVersion++; state.dirty = true; state.dialog = null
  log(`размер изменён: ${W}×${H} (одна правка)`)
}
const sideLabel = v => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')

// --- Замена нити
const target = ref(0)
const from = computed(() => state.replace && yarnById(state.replace.fromId))
watch(replaceOpen, v => { if (v) target.value = state.palette.find(y => y.id !== state.replace.fromId)?.id ?? 0 })
const others = computed(() => state.palette.filter(y => y.id !== state.replace?.fromId))
function doReplace() { applyReplace(target.value); state.dialog = null }

// --- Несохранённые изменения
function afterUnsaved(action) {
  const next = state.pendingAfterUnsaved
  if (action === 'cancel') { state.dialog = null; return }
  if (action === 'save') log('экспорт .kchart (заглушка)')
  state.dirty = false
  state.dialog = next === 'new' ? 'new' : null
  if (next === 'import') log('импорт .kchart (заглушка)')
}

// --- PDF
const pdf = reactive({ format: 'A4', orient: 'portrait', cell: 5, mode: 'both', overlap: 1, header: true, legend: true })
const PAPER = { A4: [210, 297], A3: [297, 420] }
const sheets = computed(() => {
  let [pw, ph] = PAPER[pdf.format]
  if (pdf.orient === 'landscape') [pw, ph] = [ph, pw]
  const c = state.chart
  const aspect = c.aspectAuto ? c.gauge.rows / c.gauge.stitches : c.aspect
  const cw = pdf.cell, chh = pdf.cell / aspect
  const usableW = pw - 20 - 8, usableH = ph - 20 - 8 - (pdf.header ? 0 : 0)
  const cols = Math.max(1, Math.floor(usableW / cw)), rows = Math.max(1, Math.floor(usableH / chh))
  const stepX = Math.max(1, cols - pdf.overlap), stepY = Math.max(1, rows - pdf.overlap)
  const nx = Math.max(1, Math.ceil((c.w - pdf.overlap) / stepX)), ny = Math.max(1, Math.ceil((c.h - pdf.overlap) / stepY))
  const extra = (pdf.header || pdf.legend) ? 1 : 0
  return { cols, rows, nx, ny, total: nx * ny + extra, extra, stepX, stepY }
})
function makePdf() { state.dialog = null; log(`PDF: ${sheets.value.total} лист. (заглушка)`) }
</script>

<template>
  <!-- Новая схема -->
  <UModal v-model:open="newOpen" title="Новая схема" description="Текущая схема будет заменена.">
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex items-end gap-2">
          <UFormField label="Ширина, петель"><UInputNumber v-model="nw.w" :min="1" :max="500" class="w-32" /></UFormField>
          <span class="pb-2 text-muted">×</span>
          <UFormField label="Высота, рядов"><UInputNumber v-model="nw.h" :min="1" :max="500" class="w-32" /></UFormField>
        </div>
        <UFormField label="Плотность на 10 см" description="Пропорция клетки будет вычислена из неё; можно поменять в свойствах.">
          <div class="flex items-center gap-2">
            <UInputNumber v-model="nw.st" :min="1" :max="99" class="w-28" /><span class="text-muted">петель ×</span>
            <UInputNumber v-model="nw.rows" :min="1" :max="99" class="w-28" /><span class="text-muted">рядов</span>
          </div>
        </UFormField>
        <div class="text-sm text-muted">Готовое полотно ≈ {{ (nw.w / nw.st * 10).toFixed(1) }} × {{ (nw.h / nw.rows * 10).toFixed(1) }} см</div>
      </div>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Отмена" @click="close" />
        <UButton label="Создать" @click="createNew" />
      </div>
    </template>
  </UModal>

  <!-- Изменение размера -->
  <UModal v-model:open="resizeOpen" title="Размер схемы" description="Положительное число добавляет ряды/петли с этой стороны, отрицательное — убирает.">
    <template #body>
      <div class="grid grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] items-center justify-items-center gap-3">
        <div />
        <UFormField label="Сверху, рядов"><UInputNumber v-model="rs.top" :min="1 - state.chart.h" :max="500" class="w-32" /></UFormField>
        <div />
        <UFormField label="Слева, петель"><UInputNumber v-model="rs.left" :min="1 - state.chart.w" :max="500" class="w-32" /></UFormField>
        <div class="relative flex h-28 w-28 items-center justify-center rounded border-2 border-default bg-muted text-xs tabular-nums">
          <div class="text-center"><div class="text-muted line-through" v-if="newW !== state.chart.w || newH !== state.chart.h">{{ state.chart.w }}×{{ state.chart.h }}</div>
            <div class="text-base font-semibold">{{ newW }}×{{ newH }}</div></div>
          <span class="absolute -top-0.5 left-1/2 -translate-x-1/2 -translate-y-full text-[10px]" :class="rs.top < 0 ? 'text-error' : 'text-muted'">{{ sideLabel(rs.top) }}</span>
          <span class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 translate-y-full text-[10px]" :class="rs.bottom < 0 ? 'text-error' : 'text-muted'">{{ sideLabel(rs.bottom) }}</span>
          <span class="absolute -left-1 top-1/2 -translate-x-full -translate-y-1/2 text-[10px]" :class="rs.left < 0 ? 'text-error' : 'text-muted'">{{ sideLabel(rs.left) }}</span>
          <span class="absolute -right-1 top-1/2 translate-x-full -translate-y-1/2 text-[10px]" :class="rs.right < 0 ? 'text-error' : 'text-muted'">{{ sideLabel(rs.right) }}</span>
        </div>
        <UFormField label="Справа, петель"><UInputNumber v-model="rs.right" :min="1 - state.chart.w" :max="500" class="w-32" /></UFormField>
        <div />
        <UFormField label="Снизу, рядов"><UInputNumber v-model="rs.bottom" :min="1 - state.chart.h" :max="500" class="w-32" /></UFormField>
        <div />
      </div>
      <UAlert v-if="cropped" class="mt-4" color="warning" variant="soft" icon="i-lucide-triangle-alert"
        :title="`Будет обрезано ${cropped} непустых клеток`" description="Это можно отменить через Ctrl+Z." />
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Отмена" @click="close" />
        <UButton :color="cropped ? 'warning' : 'primary'" :label="cropped ? 'Обрезать и применить' : 'Применить'"
          :disabled="newW === state.chart.w && newH === state.chart.h && !rs.top && !rs.left" @click="applyResize" />
      </div>
    </template>
  </UModal>

  <!-- Замена нити -->
  <UModal v-model:open="replaceOpen" :title="state.replace?.mode === 'delete' ? 'Удалить нить' : 'Заменить нить во всей схеме'">
    <template #body>
      <div v-if="from" class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <Swatch :yarn="from" :size="24" />
          <span>Нить {{ numberOf(from.id) }} <span class="text-muted">{{ from.name }}</span> — {{ counts.get(from.id) || 0 }} петель.</span>
        </div>
        <div class="text-sm">{{ state.replace.mode === 'delete' ? 'Чем заменить её петли перед удалением?' : 'На что заменить? Нить останется в палитре.' }}</div>
        <div class="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto">
          <button class="flex items-center gap-2 rounded border px-2 py-1 text-left text-sm"
            :class="target === 0 ? 'border-primary bg-primary/10' : 'border-default'" @click="target = 0">
            <span class="inline-block size-5 rounded-sm border border-black/20" style="background: repeating-linear-gradient(135deg,#fff 0 3px,#bbb 3px 4px)" />
            Пусто («нет петли»)
          </button>
          <button v-for="y in others" :key="y.id" class="flex items-center gap-2 rounded border px-2 py-1 text-left text-sm"
            :class="target === y.id ? 'border-primary bg-primary/10' : 'border-default'" @click="target = y.id">
            <Swatch :yarn="y" :size="20" /> {{ numberOf(y.id) }} <span class="truncate text-muted">{{ y.name }}</span>
          </button>
        </div>
      </div>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Отмена" @click="close" />
        <UButton :color="state.replace?.mode === 'delete' ? 'error' : 'primary'"
          :label="state.replace?.mode === 'delete' ? 'Заменить и удалить' : 'Заменить'" @click="doReplace" />
      </div>
    </template>
  </UModal>

  <!-- Сохранить / Отбросить / Отмена -->
  <UModal v-model:open="unsavedOpen" :dismissible="false" title="Сохранить изменения в файл?"
    description="Схема менялась после последнего сохранения в .kchart. В браузере хранится только текущая схема — после замены изменения пропадут.">
    <template #footer>
      <div class="flex w-full gap-2">
        <UButton color="error" variant="ghost" label="Отбросить" @click="afterUnsaved('discard')" />
        <UButton class="ml-auto" color="neutral" variant="outline" label="Отмена" @click="afterUnsaved('cancel')" />
        <UButton icon="i-lucide-save" label="Сохранить в файл" @click="afterUnsaved('save')" />
      </div>
    </template>
  </UModal>

  <!-- PDF -->
  <UModal v-model:open="pdfOpen" title="Экспорт PDF" :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <div class="grid grid-cols-[1fr_auto] gap-6">
        <div class="flex flex-col gap-3">
          <UFormField label="Формат">
            <UFieldGroup size="sm">
              <UButton v-for="f in ['A4', 'A3']" :key="f" :label="f" color="neutral" variant="outline" :active="pdf.format === f" active-color="primary" active-variant="soft" @click="pdf.format = f" />
            </UFieldGroup>
          </UFormField>
          <UFormField label="Ориентация">
            <UFieldGroup size="sm">
              <UButton label="Книжная" icon="i-lucide-rectangle-vertical" color="neutral" variant="outline" :active="pdf.orient === 'portrait'" active-color="primary" active-variant="soft" @click="pdf.orient = 'portrait'" />
              <UButton label="Альбомная" icon="i-lucide-rectangle-horizontal" color="neutral" variant="outline" :active="pdf.orient === 'landscape'" active-color="primary" active-variant="soft" @click="pdf.orient = 'landscape'" />
            </UFieldGroup>
          </UFormField>
          <UFormField label="Ширина клетки, мм" description="высота — по пропорции клетки">
            <UInputNumber v-model="pdf.cell" :min="2" :max="15" :step="0.5" locale="ru" class="w-32" />
          </UFormField>
          <UFormField label="Режим печати">
            <UFieldGroup size="sm">
              <UButton v-for="m in [['color', 'Цвет'], ['pattern', 'Узор'], ['both', 'Цвет+узор']]" :key="m[0]" :label="m[1]" color="neutral" variant="outline" :active="pdf.mode === m[0]" active-color="primary" active-variant="soft" @click="pdf.mode = m[0]" />
            </UFieldGroup>
          </UFormField>
          <UFormField label="Перекрытие листов" description="для склейки">
            <UFieldGroup size="sm">
              <UButton v-for="n in [0, 1, 2]" :key="n" :label="n ? `${n} ряд/петля` : 'нет'" color="neutral" variant="outline" :active="pdf.overlap === n" active-color="primary" active-variant="soft" @click="pdf.overlap = n" />
            </UFieldGroup>
          </UFormField>
          <UCheckbox v-model="pdf.header" label="Заголовок: название, размер, плотность, заметки" />
          <UCheckbox v-model="pdf.legend" label="Легенда нитей" />
        </div>
        <div class="flex w-48 flex-col items-center gap-2">
          <div class="text-sm font-medium">{{ sheets.total }} {{ sheets.total === 1 ? 'лист' : sheets.total < 5 ? 'листа' : 'листов' }}</div>
          <div class="grid gap-0.5" :style="{ gridTemplateColumns: `repeat(${sheets.nx}, 1fr)`, width: '100%' }">
            <div v-for="i in sheets.nx * sheets.ny" :key="i" class="flex items-center justify-center rounded-sm border border-default bg-muted text-[10px] text-muted"
              :style="{ aspectRatio: pdf.orient === 'portrait' ? '210/297' : '297/210' }">{{ i }}</div>
          </div>
          <div class="text-center text-xs text-muted">{{ sheets.nx }} × {{ sheets.ny }} листов схемы, по {{ sheets.cols }}×{{ sheets.rows }} клеток<span v-if="sheets.extra"> + лист заголовка и легенды</span></div>
        </div>
      </div>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Отмена" @click="close" />
        <UButton icon="i-lucide-download" label="Скачать PDF" @click="makePdf" />
      </div>
    </template>
  </UModal>

  <!-- Справка по клавишам -->
  <UModal v-model:open="keysOpen" title="Горячие клавиши" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        <div v-for="k in KEYS" :key="k.label" class="flex items-center justify-between gap-2">
          <span>{{ k.label }}</span>
          <span class="flex shrink-0 gap-1"><template v-for="(combo, ci) in k.kbds" :key="ci"><span v-if="ci" class="text-muted">/</span><UKbd v-for="kk in combo" :key="kk" :value="kk" /></template></span>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Свойства схемы (диалогом — для вариантов без боковой панели) -->
  <UModal v-model:open="propsOpen" title="Свойства схемы">
    <template #body><PropertiesForm /></template>
  </UModal>
</template>
