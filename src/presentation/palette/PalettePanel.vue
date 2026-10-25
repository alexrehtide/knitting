<script setup lang="ts">
import { computed, onScopeDispose } from 'vue'
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import { editorSessionKey, injectStrict } from '../editor/injection'
import { useEditor } from '../editor/useEditor'
import YarnEditor from './YarnEditor.vue'

const { t } = useI18n()
const { state, dispatch } = useEditor()
const toast = useToast()

onScopeDispose(
  injectStrict(editorSessionKey).subscribe((event) => {
    if (event.type === 'rejected')
      toast.add({ title: t(`palette.rejected.${event.code}`), color: 'error' })
  }),
)

const rows = computed(() =>
  state.value.chart.palette.map((yarn, i) => ({
    yarn,
    number: i + 1,
    stitches: state.value.stitchCounts.get(yarn.id) ?? 0,
  })),
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <ul :aria-label="t('palette.list')" class="min-h-0 flex-1 overflow-y-auto p-2">
      <li
        v-for="{ yarn, number, stitches } in rows"
        :key="yarn.id"
        class="relative flex items-center gap-2 rounded-md px-2 py-1 text-sm"
        :class="yarn.id === state.currentYarn ? 'bg-elevated' : 'hover:bg-elevated/50'"
      >
        <!-- The whole row selects the yarn; the swatch above it opens the yarn editor. -->
        <button
          type="button"
          class="absolute inset-0 rounded-md focus-visible:outline-2 focus-visible:outline-primary"
          :aria-label="t('palette.select', { number, name: yarn.name || t('palette.unnamed') })"
          :aria-pressed="yarn.id === state.currentYarn"
          @click="dispatch({ type: 'select-yarn', yarn: yarn.id })"
        />
        <span
          class="pointer-events-none w-6 text-right tabular-nums"
          :class="number <= 9 ? 'font-semibold text-highlighted' : 'text-dimmed'"
          >{{ number }}</span
        >
        <YarnEditor :yarn="yarn" :number="number" :stitches="stitches" />
        <span
          class="pointer-events-none min-w-0 flex-1 truncate"
          :class="yarn.name ? '' : 'text-muted italic'"
          >{{ yarn.name || t('palette.unnamed') }}</span
        >
        <span class="pointer-events-none text-muted tabular-nums">{{
          t('palette.stitches', stitches)
        }}</span>
      </li>
    </ul>
    <div class="border-t border-default p-2">
      <UButton
        :label="t('palette.add')"
        icon="i-lucide-plus"
        color="neutral"
        variant="soft"
        block
        @click="dispatch({ type: 'add-yarn' })"
      />
    </div>
  </div>
</template>
