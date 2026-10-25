<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInputNumber from '@nuxt/ui/components/InputNumber.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { NO_SIDES, resizePatch, type ResizeSides } from '../../domain/chartResize'
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

const size = computed(() => ({
  width: state.value.chart.width + sides.value.left + sides.value.right,
  height: state.value.chart.height + sides.value.top + sides.value.bottom,
}))

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
          <div class="col-start-2 row-start-2 flex size-32 items-center justify-center">
            <div
              class="flex items-center justify-center border-2 bg-elevated text-sm tabular-nums"
              :class="outOfRange ? 'border-error text-error' : 'border-default'"
              :style="miniature"
            >
              {{ t('resize.size', size) }}
            </div>
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
