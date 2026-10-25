<script setup lang="ts">
import { computed, ref, useTemplateRef, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInputNumber from '@nuxt/ui/components/InputNumber.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { NO_SIDES, resizedSize, resizePatch, type ResizeSides } from '../../domain/chartResize'
import { isValidChartDimension, MAX_CHART_DIMENSION } from '../../domain/chartSize'
import { useEditor } from '../editor/useEditor'

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const { state, dispatch } = useEditor()

const SIDES = ['top', 'left', 'right', 'bottom'] as const
type Side = (typeof SIDES)[number]

// An emptied field counts as 0.
const fields = ref<Record<Side, number | null>>({ ...NO_SIDES })

watch(open, (isOpen) => {
  if (isOpen) fields.value = { ...NO_SIDES }
})

const sides = computed<ResizeSides>(() => ({
  top: fields.value.top ?? 0,
  bottom: fields.value.bottom ?? 0,
  left: fields.value.left ?? 0,
  right: fields.value.right ?? 0,
}))

const size = computed(() => resizedSize(state.value.chart, sides.value))

const outOfRange = computed(
  () => !isValidChartDimension(size.value.width) || !isValidChartDimension(size.value.height),
)

/**
 * The field commits its number on blur or Enter; the miniature and the warning follow what is typed.
 * A text that is no whole number yet («-») leaves the side as it was.
 */
function onTyped(side: Side, event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const text = event.target.value.trim().replace('−', '-')
  if (text === '') fields.value[side] = null
  else if (/^[-+]?\d+$/.test(text)) fields.value[side] = Number(text)
}

/** The resize the fields make, or `null` when they change nothing or the size is out of 1–500. */
const resize = computed(() => resizePatch(state.value.chart, sides.value))

// The miniature keeps the chart's proportion within a 120 px square.
const MINIATURE = 120
const miniature = computed(() => {
  const width = Math.max(1, size.value.width)
  const height = Math.max(1, size.value.height)
  const scale = MINIATURE / Math.max(width, height)
  return { width: `${Math.max(24, width * scale)}px`, height: `${Math.max(24, height * scale)}px` }
})

// Added cells are lighter than the chart's own empty cells, so the new sides show.
const EMPTY_COLOR = 0xffd4d4d8
const ADDED_COLOR = 0xfff4f4f5

/** Little-endian ABGR for an `ImageData` pixel. */
function pixelOf(hex: string): number {
  const rgb = Number.parseInt(hex.slice(1), 16)
  return (0xff << 24) | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff)
}

const canvas = useTemplateRef('miniatureCanvas')

/** The chart as it will be, one pixel per cell: what is kept moved by the top and left sides. */
watchEffect(() => {
  const target = canvas.value
  const { width, height } = size.value
  if (!target || outOfRange.value) return
  const { chart } = state.value
  const { top, left } = sides.value
  target.width = width
  target.height = height
  const context = target.getContext('2d')
  if (!context) return
  const image = context.createImageData(width, height)
  const pixels = new Uint32Array(image.data.buffer)
  const colors = new Map(chart.palette.map((y) => [y.id, pixelOf(y.color)]))
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const r = row - top
      const c = column - left
      const inside = r >= 0 && r < chart.height && c >= 0 && c < chart.width
      const yarn = inside ? (chart.cells[r * chart.width + c] ?? 0) : 0
      pixels[row * width + column] = !inside
        ? ADDED_COLOR
        : yarn === 0
          ? EMPTY_COLOR
          : (colors.get(yarn) ?? EMPTY_COLOR)
    }
  }
  context.putImageData(image, 0, 0)
})

const PLACES: Record<Side, string> = {
  top: 'col-start-2 row-start-1',
  left: 'col-start-1 row-start-2',
  right: 'col-start-3 row-start-2',
  bottom: 'col-start-2 row-start-3',
}

function apply() {
  if (!resize.value) return
  dispatch({ type: 'resize-chart', sides: sides.value })
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="t('resize.title')" :description="t('resize.description')">
    <template #body>
      <form id="resize-chart" class="flex flex-col gap-4" @submit.prevent="apply">
        <div class="grid grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] items-center gap-3">
          <UFormField
            v-for="side in SIDES"
            :key="side"
            :label="t(`resize.${side}`)"
            :class="PLACES[side]"
          >
            <UInputNumber
              v-model="fields[side]"
              :min="-MAX_CHART_DIMENSION"
              :max="MAX_CHART_DIMENSION"
              class="w-28"
              @input="onTyped(side, $event)"
            />
          </UFormField>
          <div class="col-start-2 row-start-2 flex flex-col items-center gap-1">
            <div class="flex size-32 items-center justify-center">
              <canvas
                v-show="!outOfRange"
                ref="miniatureCanvas"
                class="border border-default [image-rendering:pixelated]"
                :style="miniature"
                :aria-label="t('resize.miniature')"
                role="img"
              />
            </div>
            <span class="text-sm tabular-nums" :class="outOfRange ? 'text-error' : undefined">
              {{ t('resize.size', size) }}
            </span>
          </div>
        </div>
        <p v-if="outOfRange" class="text-sm text-error">
          {{ t('resize.outOfRange', { max: MAX_CHART_DIMENSION }) }}
        </p>
        <UAlert
          v-if="resize && resize.cut > 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-scissors"
          :title="t('resize.cut', resize.cut)"
        />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          :label="t('resize.cancel')"
          color="neutral"
          variant="outline"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="resize-chart"
          :label="resize && resize.cut > 0 ? t('resize.cutAndApply') : t('resize.apply')"
          :color="resize && resize.cut > 0 ? 'warning' : 'primary'"
          :disabled="!resize"
        />
      </div>
    </template>
  </UModal>
</template>
