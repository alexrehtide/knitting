<script lang="ts">
// Each press on any yarn editor's picker gets its own merge key, so one picker drag is one edit.
let presses = 0
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UColorPicker from '@nuxt/ui/components/ColorPicker.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UPopover from '@nuxt/ui/components/Popover.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'
import { FILL_PATTERNS, type FillPattern } from '../../domain/fillPattern'
import { parseYarnColor, patternUses, yarnRemovalBlock, type Yarn } from '../../domain/palette'
import { useEditor } from '../editor/useEditor'
import PatternIcon from './PatternIcon.vue'
import YarnSwatch from './YarnSwatch.vue'

const { yarn, number, stitches } = defineProps<{ yarn: Yarn; number: number; stitches: number }>()

const { t } = useI18n()
const { state, dispatch } = useEditor()

const open = ref(false)
let mergeKey = ''
// Field drafts: they become edits when committed, on blur or Enter.
const hex = ref(yarn.color)
const name = ref(yarn.name)
const hexInvalid = computed(() => parseYarnColor(hex.value) === null)
const removalBlock = computed(() => yarnRemovalBlock(state.value.chart.palette, stitches))
const uses = computed(() => patternUses(state.value.chart.palette))
/** How many other yarns have the pattern. */
const otherUses = (pattern: FillPattern) =>
  (uses.value.get(pattern) ?? 0) - (yarn.pattern === pattern ? 1 : 0)
const clash = computed(() => (yarn.pattern ? otherUses(yarn.pattern) : 0))

watch(open, (isOpen) => {
  if (!isOpen) return
  hex.value = yarn.color
  name.value = yarn.name
})
// The picker, undo and redo change the yarn under the fields.
watch(
  () => yarn.color,
  (color) => (hex.value = color),
)
watch(
  () => yarn.name,
  (value) => (name.value = value),
)

function startDrag() {
  mergeKey = `yarn-picker-${++presses}`
}

function setColor(color: string | undefined) {
  if (color) dispatch({ type: 'update-yarn', yarn: yarn.id, changes: { color }, merge: mergeKey })
}

function commitHex() {
  if (hexInvalid.value) return
  dispatch({ type: 'update-yarn', yarn: yarn.id, changes: { color: hex.value } })
}

function setPattern(pattern: FillPattern | null) {
  dispatch({ type: 'update-yarn', yarn: yarn.id, changes: { pattern } })
}

function commitName() {
  dispatch({ type: 'update-yarn', yarn: yarn.id, changes: { name: name.value.trim() } })
}

function remove() {
  open.value = false
  dispatch({ type: 'remove-yarn', yarn: yarn.id })
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ side: 'left', align: 'start' }">
    <button
      type="button"
      class="relative z-10 rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
      :aria-label="t('palette.edit', { number })"
    >
      <YarnSwatch :color="yarn.color" :pattern="yarn.pattern" class="block size-6" />
    </button>

    <template #content>
      <div class="flex w-72 flex-col gap-3 p-3">
        <h2 class="text-sm font-medium">{{ t('yarnEditor.title', { number }) }}</h2>
        <UColorPicker
          :model-value="yarn.color"
          class="self-center"
          @pointerdown.capture="startDrag"
          @update:model-value="setColor"
        />
        <UFormField
          :label="t('yarnEditor.hex')"
          :error="hexInvalid ? t('yarnEditor.hexInvalid') : undefined"
        >
          <UInput
            v-model="hex"
            class="w-full font-mono"
            spellcheck="false"
            @blur="commitHex"
            @keydown.enter="commitHex"
          />
        </UFormField>
        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1.5 text-sm font-medium text-default">
            {{ t('yarnEditor.pattern') }}
          </legend>
          <div class="grid grid-cols-9 gap-1">
            <UTooltip :text="t('pattern.none')">
              <button
                type="button"
                class="flex h-7 items-center justify-center rounded-sm border text-muted focus-visible:outline-2 focus-visible:outline-primary"
                :class="yarn.pattern === null ? 'border-primary bg-primary/10' : 'border-default'"
                :aria-label="t('pattern.none')"
                :aria-pressed="yarn.pattern === null"
                @click="setPattern(null)"
              >
                <UIcon name="i-lucide-ban" class="size-4" />
              </button>
            </UTooltip>
            <UTooltip
              v-for="pattern in FILL_PATTERNS"
              :key="pattern"
              :text="
                otherUses(pattern) > 0
                  ? t('yarnEditor.usedBy', {
                      pattern: t(`pattern.${pattern}`),
                      n: otherUses(pattern),
                    })
                  : t(`pattern.${pattern}`)
              "
            >
              <button
                type="button"
                class="relative flex h-7 items-center justify-center rounded-sm border text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
                :class="
                  yarn.pattern === pattern ? 'border-primary bg-primary/10' : 'border-default'
                "
                :aria-label="t(`pattern.${pattern}`)"
                :aria-pressed="yarn.pattern === pattern"
                @click="setPattern(pattern)"
              >
                <PatternIcon :pattern="pattern" class="size-6" />
                <!-- «Занят»: the pattern is another yarn's. -->
                <span
                  v-if="otherUses(pattern) > 0"
                  class="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-dimmed"
                />
              </button>
            </UTooltip>
          </div>
          <UAlert
            v-if="clash > 0"
            color="warning"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :title="t('yarnEditor.clash', { n: clash })"
            :description="t('yarnEditor.clashHint')"
          />
        </fieldset>
        <UFormField :label="t('yarnEditor.name')">
          <UInput v-model="name" class="w-full" @blur="commitName" @keydown.enter="commitName" />
        </UFormField>
        <UTooltip
          :text="removalBlock ? t(`yarnEditor.blocked.${removalBlock}`) : undefined"
          :disabled="!removalBlock"
        >
          <!-- A disabled button gets no pointer events, so the tooltip hangs on its wrapper. -->
          <span class="self-start">
            <UButton
              :label="t('yarnEditor.remove')"
              icon="i-lucide-trash-2"
              color="error"
              variant="soft"
              :disabled="!!removalBlock"
              @click="remove"
            />
          </span>
        </UTooltip>
      </div>
    </template>
  </UPopover>
</template>
