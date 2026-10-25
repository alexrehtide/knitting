<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInputNumber from '@nuxt/ui/components/InputNumber.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { START_CHART_SIZE } from '../../application/editorSession'
import { finishedSize, propertyError } from '../../domain/chartProperties'
import { isValidChartDimension, MAX_CHART_DIMENSION } from '../../domain/chartSize'
import { useEditor } from '../editor/useEditor'

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const { state, dispatch } = useEditor()

const centimetres = new Intl.NumberFormat('ru', { maximumFractionDigits: 1 })

const width = ref<number | null>(START_CHART_SIZE)
const height = ref<number | null>(START_CHART_SIZE)
const stitches = ref<number | null>(null)
const rows = ref<number | null>(null)

// Each opening starts from 40 × 40 and the gauge of the chart being replaced.
watch(open, (isOpen) => {
  if (!isOpen) return
  width.value = START_CHART_SIZE
  height.value = START_CHART_SIZE
  stitches.value = state.value.chart.properties.gauge.stitches
  rows.value = state.value.chart.properties.gauge.rows
})

/** The chart the fields describe, or `null` while a field is empty or out of range. */
const chart = computed(() => {
  const gauge = { stitches: stitches.value ?? Number.NaN, rows: rows.value ?? Number.NaN }
  if (width.value === null || height.value === null) return null
  if (!isValidChartDimension(width.value) || !isValidChartDimension(height.value)) return null
  if (propertyError({ gauge })) return null
  return { width: width.value, height: height.value, gauge }
})

const finished = computed(() => {
  if (!chart.value) return undefined
  const size = finishedSize(chart.value, chart.value.gauge)
  return t('properties.finished', {
    width: centimetres.format(size.width),
    height: centimetres.format(size.height),
  })
})

function create() {
  if (!chart.value) return
  dispatch({ type: 'new-chart', ...chart.value })
  open.value = false
}

// A gauge may have a fraction, so the steppers move by 1 without rounding what was typed.
const gaugeFormat = { maximumFractionDigits: 2, useGrouping: false }
</script>

<template>
  <UModal v-model:open="open" :title="t('newChart.title')">
    <template #body>
      <form id="new-chart" class="flex flex-col gap-4" @submit.prevent="create">
        <div class="flex items-end gap-2">
          <UFormField :label="t('newChart.width')" class="flex-1">
            <UInputNumber v-model="width" :min="1" :max="MAX_CHART_DIMENSION" class="w-full" />
          </UFormField>
          <span class="pb-1.5 text-muted">×</span>
          <UFormField :label="t('newChart.height')" class="flex-1">
            <UInputNumber v-model="height" :min="1" :max="MAX_CHART_DIMENSION" class="w-full" />
          </UFormField>
        </div>
        <UFormField
          :label="t('properties.gauge')"
          :hint="t('properties.gaugeUnit')"
          :help="finished"
        >
          <div class="flex items-center gap-2">
            <UInputNumber
              v-model="stitches"
              :min="0.01"
              :step-snapping="false"
              :format-options="gaugeFormat"
              :aria-label="t('properties.gaugeStitches')"
              class="w-full"
            />
            <span class="text-muted">×</span>
            <UInputNumber
              v-model="rows"
              :min="0.01"
              :step-snapping="false"
              :format-options="gaugeFormat"
              :aria-label="t('properties.gaugeRows')"
              class="w-full"
            />
          </div>
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          :label="t('newChart.cancel')"
          color="neutral"
          variant="outline"
          @click="open = false"
        />
        <UButton type="submit" form="new-chart" :label="t('newChart.create')" :disabled="!chart" />
      </div>
    </template>
  </UModal>
</template>
