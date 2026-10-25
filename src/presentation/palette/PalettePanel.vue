<script setup lang="ts">
import { computed, onScopeDispose, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import { patternClashCount, patternUses, type YarnId } from '../../domain/palette'
import { editorSessionKey, injectStrict } from '../editor/injection'
import { useEditor } from '../editor/useEditor'
import YarnEditor from './YarnEditor.vue'
import YarnReplaceModal, { type ReplacedYarn } from './YarnReplaceModal.vue'

const { t } = useI18n()
const { state, dispatch } = useEditor()
const toast = useToast()

onScopeDispose(
  injectStrict(editorSessionKey).subscribe((event) => {
    // Property edits the session refuses never come from the «Схема» tab: its fields check them first.
    if (event.type === 'rejected' && event.code === 'palette-full')
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
const replaced = ref<ReplacedYarn | null>(null)
function openReplacement(next: ReplacedYarn) {
  replaced.value = next
  replacing.value = true
}

/**
 * A yarn dragged by its handle ⋮⋮: `gap` is where a drop puts it, the gap before row `gap` (0-based),
 * `rows.length` for after the last row; `null` while the pointer is beside the list or the drop would
 * leave the yarn where it is. The session ignores the drop during a chart gesture by itself.
 */
const drag = ref<{
  pointerId: number
  handle: Element
  yarn: YarnId
  gap: number | null
} | null>(null)
const list = useTemplateRef('list')

/** The yarn's place in the palette now, read on each move, as an undo may change it during the drag. */
const indexOf = (yarn: YarnId) => rows.value.findIndex((row) => row.yarn.id === yarn)

function startDrag(event: PointerEvent, yarn: YarnId) {
  if (event.button !== 0 || drag.value) return
  event.preventDefault()
  const handle = event.currentTarget as Element
  handle.setPointerCapture(event.pointerId)
  drag.value = { pointerId: event.pointerId, handle, yarn, gap: null }
  window.addEventListener('keydown', onDragKey, true)
  window.addEventListener('blur', stopDrag)
}

/** The gap whose rows above have their middle above the pointer. */
function moveDrag(event: PointerEvent) {
  if (drag.value?.pointerId !== event.pointerId || !list.value) return
  const { left, right } = list.value.getBoundingClientRect()
  const items = [...list.value.children].filter((el) => el.tagName === 'LI')
  const gap = items.filter((el) => {
    const { top, height } = el.getBoundingClientRect()
    return top + height / 2 < event.clientY
  }).length
  const from = indexOf(drag.value.yarn)
  const beside = event.clientX < left || event.clientX > right
  drag.value = { ...drag.value, gap: beside || gap === from || gap === from + 1 ? null : gap }
}

function endDrag(event: PointerEvent, drop: boolean) {
  if (drag.value?.pointerId !== event.pointerId) return
  const { yarn, gap } = drag.value
  stopDrag()
  if (!drop || gap === null) return
  // A gap below the yarn's own row counts the yarn itself, which leaves its place.
  dispatch({ type: 'move-yarn', yarn, position: gap > indexOf(yarn) ? gap - 1 : gap })
}

/** Lets go of the yarn where it was. */
function stopDrag() {
  const ended = drag.value
  drag.value = null
  window.removeEventListener('keydown', onDragKey, true)
  window.removeEventListener('blur', stopDrag)
  if (ended?.handle.hasPointerCapture(ended.pointerId))
    ended.handle.releasePointerCapture(ended.pointerId)
}

function onDragKey(event: KeyboardEvent) {
  if (event.code !== 'Escape') return
  // Caught first, so the drag takes this Esc and nothing else does.
  event.preventDefault()
  event.stopImmediatePropagation()
  stopDrag()
}

onScopeDispose(stopDrag)
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
    <ul ref="list" :aria-label="t('palette.list')" class="min-h-0 flex-1 overflow-y-auto p-2">
      <li
        v-for="({ yarn, number, stitches, clash }, i) in rows"
        :key="yarn.id"
        class="relative flex items-center gap-2 rounded-md py-1 pr-2 pl-1 text-sm"
        :class="[
          yarn.id === state.currentYarn ? 'bg-elevated' : 'hover:bg-elevated/50',
          drag?.yarn === yarn.id && 'opacity-50',
        ]"
      >
        <!-- The insertion line: at the top of the row it goes before, at the bottom of the last row. -->
        <span
          v-if="drag && (drag.gap === i || (drag.gap === rows.length && i === rows.length - 1))"
          role="separator"
          :aria-label="t('palette.dropHere')"
          class="pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-primary"
          :class="drag.gap === i ? '-top-px' : '-bottom-px'"
        />
        <!-- Above the row's button; there is no keyboard way to move a yarn (docs/spec.md, «Палитра»). -->
        <span
          :aria-label="t('palette.drag', { number })"
          :title="t('palette.dragHint')"
          class="relative z-10 flex h-6 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-dimmed hover:text-default"
          :class="drag && 'cursor-grabbing'"
          @pointerdown="startDrag($event, yarn.id)"
          @pointermove="moveDrag"
          @pointerup="endDrag($event, true)"
          @pointercancel="endDrag($event, false)"
          @lostpointercapture="endDrag($event, false)"
        >
          <UIcon name="i-lucide-grip-vertical" class="size-4" />
        </span>
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
    <YarnReplaceModal v-model:open="replacing" :target="replaced" />
  </div>
</template>
