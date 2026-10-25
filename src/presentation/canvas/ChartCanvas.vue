<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChartRenderer } from '../../application/chartRenderer'
import { chartRendererKey, injectStrict } from '../editor/injection'
import type { ChartView } from './useChartView'

const { view } = defineProps<{ view: ChartView }>()

const { t } = useI18n()
const createRenderer = injectStrict(chartRendererKey)
const canvas = useTemplateRef('canvas')

let renderer: ChartRenderer | null = null
let resizeObserver: ResizeObserver | null = null
let stopDprWatch = () => {}

const spaceHeld = ref(false)
const pan = ref<{ pointerId: number; x: number; y: number } | null>(null)
const cursor = computed(() => (pan.value ? 'grabbing' : spaceHeld.value ? 'grab' : 'default'))

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

function onPointerDown(event: PointerEvent) {
  const panButton = event.button === 1 || (event.button === 0 && spaceHeld.value)
  if (!panButton || pan.value) return
  // Stops the browser's middle-button autoscroll.
  event.preventDefault()
  canvas.value?.setPointerCapture(event.pointerId)
  pan.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
}

function onPointerMove(event: PointerEvent) {
  if (pan.value?.pointerId !== event.pointerId) return
  view.scroll(pan.value.x - event.clientX, pan.value.y - event.clientY)
  pan.value = { ...pan.value, x: event.clientX, y: event.clientY }
}

function onPointerUp(event: PointerEvent) {
  if (pan.value?.pointerId === event.pointerId) pan.value = null
}

function onKeyDown(event: KeyboardEvent) {
  // Space belongs to a focused control (button, tab, field); it pans only when nothing is focused.
  if (event.code !== 'Space' || event.target !== document.body) return
  event.preventDefault()
  spaceHeld.value = true
}

function onKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') spaceHeld.value = false
}

function onBlur() {
  spaceHeld.value = false
}

onMounted(() => {
  const el = canvas.value
  if (!el) return
  renderer = createRenderer(el)
  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(el)
  watchDpr()
  measure()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
})

watch(view.viewport, (viewport) => renderer?.setViewport(viewport), { immediate: true })

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
    @auxclick.prevent
  />
</template>
