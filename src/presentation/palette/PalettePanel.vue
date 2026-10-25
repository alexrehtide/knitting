<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import { patternClashCount, patternUses } from '../../domain/palette'
import { editorSessionKey, injectStrict } from '../editor/injection'
import { useEditor } from '../editor/useEditor'
import YarnEditor from './YarnEditor.vue'
import YarnReplaceModal, { type YarnReplacement } from './YarnReplaceModal.vue'

const { t } = useI18n()
const { state, dispatch } = useEditor()
const toast = useToast()

onScopeDispose(
  injectStrict(editorSessionKey).subscribe((event) => {
    if (event.type === 'rejected')
      toast.add({ title: t(`palette.rejected.${event.code}`), color: 'error' })
  }),
)

const rows = computed(() => {
  const { palette } = state.value.chart
  const uses = patternUses(palette)
  return palette.map((yarn, i) => ({
    yarn,
    number: i + 1,
    stitches: state.value.stitchCounts.get(yarn.id) ?? 0,
    clash: yarn.pattern !== null && (uses.get(yarn.pattern) ?? 0) > 1,
  }))
})
const clashes = computed(() => patternClashCount(state.value.chart.palette))

// The dialog keeps its last yarn while it closes, so its content does not vanish mid-animation.
const replacing = ref(false)
const replacement = ref<YarnReplacement | null>(null)
function openReplacement(next: YarnReplacement) {
  replacement.value = next
  replacing.value = true
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <UAlert
      v-if="clashes > 0"
      color="warning"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="t('palette.clash', clashes)"
      :description="t('palette.clashHint')"
      class="m-2 mb-0 w-auto"
    />
    <ul :aria-label="t('palette.list')" class="min-h-0 flex-1 overflow-y-auto p-2">
      <li
        v-for="{ yarn, number, stitches, clash } in rows"
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
        <YarnEditor
          :yarn="yarn"
          :number="number"
          :stitches="stitches"
          @replace="(remove) => openReplacement({ yarn: yarn.id, remove })"
        />
        <span
          class="pointer-events-none min-w-0 flex-1 truncate"
          :class="yarn.name ? '' : 'text-muted italic'"
          >{{ yarn.name || t('palette.unnamed') }}</span
        >
        <span class="pointer-events-none text-muted tabular-nums">{{
          t('palette.stitches', stitches)
        }}</span>
        <!-- A fixed slot, so the counts stay in one column with and without the icon. -->
        <span class="pointer-events-none flex size-4 shrink-0">
          <!-- The icon itself is aria-hidden, so the label goes on its own wrapper. -->
          <span v-if="clash" role="img" :aria-label="t('palette.yarnClash')" class="flex">
            <UIcon name="i-lucide-triangle-alert" class="size-4 text-warning" />
          </span>
        </span>
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
    <YarnReplaceModal v-model:open="replacing" :replacement="replacement" />
  </div>
</template>
