<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'
import type { YarnId } from '../../domain/palette'
import type { Command } from '../commands/registry'
import { useCommands } from '../commands/useCommands'
import { useEditor } from '../editor/useEditor'
import YarnSwatch from '../palette/YarnSwatch.vue'

const { t } = useI18n()
const { state, dispatch } = useEditor()

const palette = computed(() => state.value.chart.palette)
const yarn = (id: YarnId) => palette.value.find((y) => y.id === id)
const numberOf = (id: YarnId) => palette.value.findIndex((y) => y.id === id) + 1
const swap = () => dispatch({ type: 'swap-yarns' })

// The session ignores yarn changes during a gesture by itself.
useCommands([
  { id: 'yarn.swap', label: 'yarn.swap', keys: [{ code: 'KeyX' }], run: swap },
  // Nine commands, shown in the help as one row «1–9».
  ...Array.from({ length: 9 }, (_, i): Command => ({
    id: `yarn.${i + 1}`,
    label: 'yarn.byNumber',
    keys: [
      i === 0 ? { code: 'Digit1', kbds: ['1–9'] } : { code: `Digit${i + 1}`, hidden: true },
      { code: `Numpad${i + 1}`, hidden: true },
    ],
    run: () => {
      const chosen = palette.value[i]
      if (chosen) dispatch({ type: 'select-yarn', yarn: chosen.id })
    },
    enabled: () => i < palette.value.length,
  })),
])
</script>

<template>
  <UTooltip :text="t('yarn.swap')" :kbds="['X']" :content="{ side: 'right' }">
    <button
      type="button"
      class="relative size-9 rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
      :aria-label="t('yarn.swap')"
      :aria-description="
        t('yarn.pair', {
          current: numberOf(state.currentYarn),
          previous: numberOf(state.previousYarn),
        })
      "
      @click="swap"
    >
      <YarnSwatch
        :color="yarn(state.previousYarn)?.color ?? 'transparent'"
        class="absolute right-0 bottom-0 size-6"
      />
      <YarnSwatch
        :color="yarn(state.currentYarn)?.color ?? 'transparent'"
        class="absolute top-0 left-0 size-6 shadow-[0_0_0_2px_var(--ui-bg)]"
      />
    </button>
  </UTooltip>
</template>
