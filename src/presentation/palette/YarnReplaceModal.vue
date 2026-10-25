<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import type { YarnId } from '../../domain/palette'
import { useEditor } from '../editor/useEditor'
import YarnSwatch from './YarnSwatch.vue'

/** The yarn to replace; `remove` — the replacement removes it from the palette too. */
export interface YarnReplacement {
  readonly yarn: YarnId
  readonly remove: boolean
}

const open = defineModel<boolean>('open', { required: true })
const { replacement } = defineProps<{ replacement: YarnReplacement | null }>()

const { t } = useI18n()
const { state, dispatch } = useEditor()

/** The yarn chosen to stand in for the replaced one; 0 — «пусто», `null` — nothing chosen yet. */
const chosen = ref<YarnId | null>(null)
watch(open, (isOpen) => {
  if (isOpen) chosen.value = null
})

const rows = computed(() =>
  state.value.chart.palette.map((yarn, i) => ({
    yarn,
    number: i + 1,
    label: t('palette.select', { number: i + 1, name: yarn.name || t('palette.unnamed') }),
  })),
)
const replaced = computed(() => rows.value.find((row) => row.yarn.id === replacement?.yarn))
const options = computed(() => rows.value.filter((row) => row.yarn.id !== replacement?.yarn))

function confirm() {
  if (!replacement || chosen.value === null) return
  const { yarn, remove } = replacement
  dispatch({ type: remove ? 'remove-yarn' : 'replace-yarn', yarn, replacement: chosen.value })
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('yarnReplace.title')"
    :description="t(replacement?.remove ? 'yarnReplace.removeHint' : 'yarnReplace.replaceHint')"
  >
    <template #body>
      <div v-if="replaced" class="flex flex-col gap-4">
        <div class="flex items-center gap-2 text-sm">
          <YarnSwatch
            :color="replaced.yarn.color"
            :pattern="replaced.yarn.pattern"
            class="size-6"
          />
          <span class="min-w-0 flex-1 truncate">{{ replaced.label }}</span>
          <span class="text-muted tabular-nums">{{
            t('palette.stitches', state.stitchCounts.get(replaced.yarn.id) ?? 0)
          }}</span>
        </div>
        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1.5 text-sm font-medium text-default">
            {{ t('yarnReplace.with') }}
          </legend>
          <div class="grid grid-cols-2 gap-1">
            <button
              type="button"
              class="flex items-center gap-2 rounded-md border px-2 py-1 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary"
              :class="chosen === 0 ? 'border-primary bg-primary/10' : 'border-default'"
              :aria-pressed="chosen === 0"
              @click="chosen = 0"
            >
              <!-- The «нет петли» hatch, as empty cells have on the canvas. -->
              <span
                class="size-6 shrink-0 rounded-sm ring-1 ring-black/25 ring-inset"
                style="
                  background: linear-gradient(
                    to top right,
                    #f1f1f3 calc(50% - 1px),
                    #a1a1aa calc(50% - 1px) calc(50% + 1px),
                    #f1f1f3 calc(50% + 1px)
                  );
                "
              />
              <span class="min-w-0 truncate">{{ t('yarnReplace.empty') }}</span>
            </button>
            <button
              v-for="{ yarn, label } in options"
              :key="yarn.id"
              type="button"
              class="flex items-center gap-2 rounded-md border px-2 py-1 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary"
              :class="chosen === yarn.id ? 'border-primary bg-primary/10' : 'border-default'"
              :aria-pressed="chosen === yarn.id"
              @click="chosen = yarn.id"
            >
              <YarnSwatch :color="yarn.color" :pattern="yarn.pattern" class="size-6" />
              <span class="min-w-0 truncate">{{ label }}</span>
            </button>
          </div>
        </fieldset>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          :label="t('yarnReplace.cancel')"
          color="neutral"
          variant="outline"
          @click="open = false"
        />
        <UButton
          :label="t(replacement?.remove ? 'yarnReplace.replaceAndRemove' : 'yarnReplace.replace')"
          :disabled="chosen === null"
          @click="confirm"
        />
      </div>
    </template>
  </UModal>
</template>
