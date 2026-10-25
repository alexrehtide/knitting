<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'
import type { ChartProperties } from '../../domain/chart'
import {
  cellAspectRatio,
  finishedSize,
  propertyError,
  type PropertyChanges,
} from '../../domain/chartProperties'
import { useEditor } from '../editor/useEditor'

type Numbering = ChartProperties['numbering']

const { t } = useI18n()
const { state, dispatch } = useEditor()

const properties = computed(() => state.value.chart.properties)

const decimal = new Intl.NumberFormat('ru', { maximumFractionDigits: 2, useGrouping: false })
const centimetres = new Intl.NumberFormat('ru', { maximumFractionDigits: 1 })
const dateTime = new Intl.DateTimeFormat('ru', { dateStyle: 'long', timeStyle: 'short' })

/** A decimal as typed, with a comma or a dot before the fraction; `NaN` for anything else. */
function parseNumber(text: string): number {
  const trimmed = text.trim()
  return /^\d+([.,]\d+)?$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : Number.NaN
}

/**
 * A field's draft, shown as the property is (undo and redo reset it), and its commit. A commit sends
 * the edit only when the draft differs from what was shown, so a ratio shown rounded is not rounded
 * by a blur; an invalid draft stays with its error, a valid one shows as the property now is
 * («20,0» → «20»).
 */
function field(
  shown: () => string,
): [Ref<string>, (invalid: boolean, changes: () => PropertyChanges) => void] {
  const text = ref(shown())
  watch(shown, (value) => (text.value = value))
  function commit(invalid: boolean, changes: () => PropertyChanges) {
    if (text.value === shown()) return
    if (invalid) return
    update(changes())
    text.value = shown()
  }
  return [text, commit]
}

// Field drafts become edits when committed: on blur or Enter, notes on blur only.
const [title, commitTitleField] = field(() => properties.value.title)
const [notes, commitNotesField] = field(() => properties.value.notes)
const [stitches, commitStitches] = field(() => decimal.format(properties.value.gauge.stitches))
const [rows, commitRows] = field(() => decimal.format(properties.value.gauge.rows))
const [ratio, commitRatioField] = field(() => decimal.format(cellAspectRatio(properties.value)))
const [majorStep, commitMajorStepField] = field(() => String(properties.value.majorStep))

const gauge = computed(() => ({
  stitches: parseNumber(stitches.value),
  rows: parseNumber(rows.value),
}))
const gaugeInvalid = computed(() => propertyError({ gauge: gauge.value }) !== null)
const ratioInvalid = computed(
  () => propertyError({ cellAspect: { mode: 'manual', ratio: parseNumber(ratio.value) } }) !== null,
)
const majorStepInvalid = computed(
  () => propertyError({ majorStep: parseNumber(majorStep.value) }) !== null,
)

const finished = computed(() => {
  const size = finishedSize(state.value.chart, properties.value.gauge)
  return t('properties.finished', {
    width: centimetres.format(size.width),
    height: centimetres.format(size.height),
  })
})

function update(changes: PropertyChanges) {
  dispatch({ type: 'update-properties', changes })
}

const commitTitle = () => commitTitleField(false, () => ({ title: title.value.trim() }))
const commitNotes = () => commitNotesField(false, () => ({ notes: notes.value }))
const commitGauge = (commit: typeof commitStitches) =>
  commit(gaugeInvalid.value, () => ({ gauge: gauge.value }))
const commitRatio = () =>
  commitRatioField(ratioInvalid.value, () => ({
    cellAspect: { mode: 'manual', ratio: parseNumber(ratio.value) },
  }))
const commitMajorStep = () =>
  commitMajorStepField(majorStepInvalid.value, () => ({ majorStep: parseNumber(majorStep.value) }))

const aspectModes = computed(() => [
  { label: t('properties.aspectAuto'), value: 'auto' },
  { label: t('properties.aspectManual'), value: 'manual' },
])

/** «Вручную» starts from the ratio of «авто», so the cells do not change until the user types another. */
function setAspectMode(mode: string) {
  update({
    cellAspect:
      mode === 'auto'
        ? { mode: 'auto' }
        : { mode: 'manual', ratio: cellAspectRatio(properties.value) },
  })
}

const NUMBERINGS: readonly Numbering[] = [
  { rows: 'bottom-up', stitches: 'right-to-left' },
  { rows: 'bottom-up', stitches: 'left-to-right' },
  { rows: 'top-down', stitches: 'right-to-left' },
  { rows: 'top-down', stitches: 'left-to-right' },
]
const numberingKey = ({ rows, stitches }: Numbering) => `${rows} ${stitches}`
const numberings = computed(() =>
  NUMBERINGS.map((n) => ({
    label: t('properties.numberingOption', {
      rows: t(`properties.rows.${n.rows}`),
      stitches: t(`properties.stitches.${n.stitches}`),
    }),
    value: numberingKey(n),
  })),
)

function setNumbering(key: string) {
  const numbering = NUMBERINGS.find((n) => numberingKey(n) === key)
  if (numbering) update({ numbering })
}
</script>

<template>
  <form class="flex min-h-0 flex-col gap-4 overflow-y-auto p-3" @submit.prevent>
    <UFormField :label="t('properties.title')">
      <UInput
        v-model="title"
        class="w-full"
        :placeholder="t('chart.untitled')"
        @blur="commitTitle"
        @keydown.enter="commitTitle"
      />
    </UFormField>

    <UFormField :label="t('properties.notes')">
      <UTextarea v-model="notes" class="w-full" :rows="3" autoresize @blur="commitNotes" />
    </UFormField>

    <UFormField
      :label="t('properties.gauge')"
      :hint="t('properties.gaugeUnit')"
      :error="gaugeInvalid ? t('properties.gaugeInvalid') : undefined"
      :help="gaugeInvalid ? undefined : finished"
    >
      <div class="flex items-center gap-2">
        <UInput
          v-model="stitches"
          class="w-full"
          inputmode="decimal"
          :aria-label="t('properties.gaugeStitches')"
          @blur="commitGauge(commitStitches)"
          @keydown.enter="commitGauge(commitStitches)"
        />
        <span class="text-muted">×</span>
        <UInput
          v-model="rows"
          class="w-full"
          inputmode="decimal"
          :aria-label="t('properties.gaugeRows')"
          @blur="commitGauge(commitRows)"
          @keydown.enter="commitGauge(commitRows)"
        />
      </div>
    </UFormField>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-2 text-sm font-medium text-default">{{ t('properties.aspect') }}</legend>
      <URadioGroup
        :model-value="properties.cellAspect.mode"
        :items="aspectModes"
        orientation="horizontal"
        :aria-label="t('properties.aspect')"
        @update:model-value="(mode) => setAspectMode(String(mode))"
      />
      <UFormField
        :error="
          ratioInvalid && properties.cellAspect.mode === 'manual'
            ? t('properties.aspectInvalid')
            : undefined
        "
        :help="t('properties.aspectHint')"
      >
        <UInput
          v-model="ratio"
          class="w-full"
          inputmode="decimal"
          :aria-label="t('properties.aspectRatio')"
          :disabled="properties.cellAspect.mode === 'auto'"
          @blur="commitRatio"
          @keydown.enter="commitRatio"
        />
      </UFormField>
    </fieldset>

    <URadioGroup
      :legend="t('properties.numbering')"
      :model-value="numberingKey(properties.numbering)"
      :items="numberings"
      @update:model-value="(key) => setNumbering(String(key))"
    />

    <UFormField
      :label="t('properties.majorStep')"
      :error="majorStepInvalid ? t('properties.majorStepInvalid') : undefined"
    >
      <UInput
        v-model="majorStep"
        class="w-full"
        inputmode="numeric"
        @blur="commitMajorStep"
        @keydown.enter="commitMajorStep"
      />
    </UFormField>

    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt class="text-muted">{{ t('properties.createdAt') }}</dt>
      <dd>{{ dateTime.format(properties.createdAt) }}</dd>
      <dt class="text-muted">{{ t('properties.modifiedAt') }}</dt>
      <dd>{{ dateTime.format(properties.modifiedAt) }}</dd>
    </dl>
  </form>
</template>
