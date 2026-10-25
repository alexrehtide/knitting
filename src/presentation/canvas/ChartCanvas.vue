<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChartRenderer } from '../../application/chartRenderer'
import type { EditorCommand } from '../../application/editorSession'
import { keyboardTaken } from '../commands/registry'
import { chartRendererKey, injectStrict } from '../editor/injection'
import { useEditor } from '../editor/useEditor'
import type { ChartView } from './useChartView'

const { view } = defineProps<{ view: ChartView }>()

const { t } = useI18n()
const { state, dispatch } = useEditor()
const createRenderer = injectStrict(chartRendererKey)
const canvas = useTemplateRef('canvas')
const overlay = useTemplateRef('overlay')
const rulerX = useTemplateRef('rulerX')
const rulerY = useTemplateRef('rulerY')

let renderer: ChartRenderer | null = null
let resizeObserver: ResizeObserver | null = null
let stopDprWatch = () => {}

const spaceHeld = ref(false)
const pan = ref<{ pointerId: number; x: number; y: number } | null>(null)
/** A tool gesture: its pointer and button, the last pointer point in CSS px of the canvas and Shift. */
let gesture: { pointerId: number; button: number; x: number; y: number; shift: boolean } | null =
  null
const cursor = computed(() => {
  if (pan.value) return 'grabbing'
  if (spaceHeld.value) return 'grab'
  if (!state.value.gestureActive && !view.hoverCell.value) return 'default'
  return state.value.activeTool === 'eyedropper' ? EYEDROPPER_CURSOR : 'crosshair'
})

// The Lucide pipette, outlined in white so it shows on dark yarns; the hotspot is its tip.
const PIPETTE_PATHS =
  '<path d="m12 9l-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12"/>' +
  '<path d="m18 9l.4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4l3.4-3.4a1 1 0 1 1 3 3zM2 22l.414-.414"/>'
const PIPETTE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
  `<g stroke="white" stroke-width="4">${PIPETTE_PATHS}</g><g stroke="black" stroke-width="2">${PIPETTE_PATHS}</g></svg>`
const EYEDROPPER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(PIPETTE_SVG)}") 2 22, crosshair`

// `MouseEvent.button` → its bit in `MouseEvent.buttons`.
const BUTTON_BITS = [1, 4, 2, 8, 16]

// A mouse wheel notch gives ~100 px; a trackpad pinch gives many small deltas, so they add up to a step.
const ZOOM_STEP_DELTA = 50
const LINE_HEIGHT = 16
let zoomDelta = 0

function measure() {
  const el = canvas.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  const size = { width, height, dpr: window.devicePixelRatio || 1 }
  renderer?.setSize(size)
  view.setSize(size)
}

function watchDpr() {
  const query = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
  const onChange = () => {
    measure()
    stopDprWatch()
    watchDpr()
  }
  query.addEventListener('change', onChange, { once: true })
  stopDprWatch = () => query.removeEventListener('change', onChange)
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT : 1
  if (event.ctrlKey || event.metaKey) {
    zoomDelta += event.deltaY * scale
    if (Math.abs(zoomDelta) < ZOOM_STEP_DELTA) return
    const direction = zoomDelta < 0 ? 1 : -1
    zoomDelta = 0
    const rect = canvas.value?.getBoundingClientRect()
    view.zoom(direction, event.clientX - (rect?.left ?? 0), event.clientY - (rect?.top ?? 0))
    return
  }
  view.scroll(event.deltaX * scale, event.deltaY * scale)
}

function canvasPoint(event: MouseEvent) {
  const rect = canvas.value?.getBoundingClientRect()
  return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
}

function onPointerDown(event: PointerEvent) {
  if (gesture) {
    // Another pointer pressed during the gesture counts as a second button.
    pressSecondButton(event)
    return
  }
  const panButton = event.button === 1 || (event.button === 0 && spaceHeld.value)
  if (panButton) {
    if (pan.value) return
    // Stops the browser's middle-button autoscroll.
    event.preventDefault()
    canvas.value?.setPointerCapture(event.pointerId)
    pan.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    return
  }
  if ((event.button !== 0 && event.button !== 2) || pan.value) return
  const { x, y } = canvasPoint(event)
  dispatch({
    type: 'pointer-down',
    cell: view.gestureCellAt(x, y),
    button: event.button === 0 ? 'primary' : 'secondary',
    shift: event.shiftKey,
  })
  // A gesture started off the grid does nothing.
  if (!state.value.gestureActive) return
  canvas.value?.setPointerCapture(event.pointerId)
  gesture = { pointerId: event.pointerId, button: event.button, x, y, shift: event.shiftKey }
}

/** The session cancels the gesture on a second press. */
function pressSecondButton(event: PointerEvent) {
  const { x, y } = canvasPoint(event)
  endGesture({
    type: 'pointer-down',
    cell: view.gestureCellAt(x, y),
    button: 'secondary',
    shift: event.shiftKey,
  })
}

/** Sends the session the command that ends the gesture, and lets the pointer go. */
function endGesture(command: EditorCommand) {
  if (!gesture) return
  dispatch(command)
  if (canvas.value?.hasPointerCapture(gesture.pointerId))
    canvas.value.releasePointerCapture(gesture.pointerId)
  gesture = null
}

function onPointerMove(event: PointerEvent) {
  view.setPointer(canvasPoint(event))
  if (gesture?.pointerId === event.pointerId) {
    // A pointer with a button already down reports another button's press as a move.
    const pressed = event.button >= 0 && event.buttons & (BUTTON_BITS[event.button] ?? 0)
    if (pressed && event.button !== gesture.button) {
      pressSecondButton(event)
      return
    }
    // Every real pointer position, not only the last one of the frame.
    const points = event.getCoalescedEvents?.() ?? []
    for (const point of points.length > 0 ? points : [event])
      moveGesture({ ...canvasPoint(point), shift: event.shiftKey })
    return
  }
  if (pan.value?.pointerId !== event.pointerId) return
  view.scroll(pan.value.x - event.clientX, pan.value.y - event.clientY)
  pan.value = { ...pan.value, x: event.clientX, y: event.clientY }
}

function moveGesture(point: { x: number; y: number; shift: boolean }) {
  if (!gesture) return
  Object.assign(gesture, point)
  dispatch({ type: 'pointer-move', cell: view.gestureCellAt(point.x, point.y), shift: point.shift })
}

function onPointerUp(event: PointerEvent) {
  if (gesture?.pointerId === event.pointerId) endGesture({ type: 'pointer-up' })
  if (pan.value?.pointerId === event.pointerId) pan.value = null
}

function onKeyDown(event: KeyboardEvent) {
  if (event.code === 'Escape' && gesture) {
    event.preventDefault()
    endGesture({ type: 'cancel-gesture' })
    return
  }
  // Held Alt is the eyedropper, unless the key belongs to a field or an open popover; the session
  // ignores it during a gesture.
  if (event.key === 'Alt') {
    if (!keyboardTaken(event)) dispatch({ type: 'hold-eyedropper', held: true })
    return
  }
  // Space belongs to a focused control (button, tab, field); it pans only when nothing is focused.
  if (event.code !== 'Space' || event.target !== document.body || gesture) return
  event.preventDefault()
  spaceHeld.value = true
}

function onKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') spaceHeld.value = false
  if (event.key === 'Alt') {
    // Firefox shows its menu bar on a lone Alt release.
    event.preventDefault()
    dispatch({ type: 'hold-eyedropper', held: false })
  }
}

function onBlur() {
  spaceHeld.value = false
  dispatch({ type: 'hold-eyedropper', held: false })
  // Losing focus keeps the gesture, as releasing the button does.
  endGesture({ type: 'pointer-up' })
}

onMounted(() => {
  const el = canvas.value
  if (!el || !overlay.value || !rulerX.value || !rulerY.value) return
  renderer = createRenderer({
    chart: el,
    overlay: overlay.value,
    rulerX: rulerX.value,
    rulerY: rulerY.value,
  })
  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(el)
  watchDpr()
  measure()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
})

watch(
  view.viewport,
  (viewport) => {
    renderer?.setViewport(viewport)
    // The wheel zooms or scrolls under a still pointer: the gesture follows to the cell now under it.
    if (gesture) moveGesture(gesture)
  },
  { immediate: true },
)
watch([view.hoverCell, view.lineHighlight], ([cell, lines]) => renderer?.setHover({ cell, lines }))

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  stopDprWatch()
  renderer?.dispose()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
})
</script>

<template>
  <div class="absolute inset-0 grid grid-cols-[2rem_1fr] grid-rows-[1.25rem_1fr]">
    <div class="border-r border-b border-default bg-elevated" />
    <canvas ref="rulerX" data-testid="ruler-x" aria-hidden="true" class="size-full" />
    <canvas ref="rulerY" data-testid="ruler-y" aria-hidden="true" class="size-full" />
    <div class="relative min-h-0 min-w-0">
      <canvas
        ref="canvas"
        role="img"
        :aria-label="t('chart.canvasLabel')"
        data-testid="chart-canvas"
        class="absolute inset-0 size-full touch-none"
        :style="{ cursor }"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="view.setPointer(null)"
        @auxclick.prevent
        @contextmenu.prevent
      />
      <canvas
        ref="overlay"
        data-testid="chart-overlay"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 size-full"
      />
    </div>
  </div>
</template>
