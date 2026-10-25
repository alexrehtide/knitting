import { computed, shallowRef, watch, type ShallowRef } from 'vue'
import type { EditorState } from '../../application/editorSession'
import type { Viewport, ViewSize } from '../../application/chartRenderer'
import { fitViewport, scrollBy, zoomAt, zoomPercent } from './viewport'

/**
 * Zoom and scroll of the canvas. They are view state, not edits, so they live here rather than in the session.
 * The view fits the chart when the canvas first gets a size and whenever the chart is replaced.
 */
export function useChartView(state: ShallowRef<EditorState>) {
  const viewport = shallowRef<Viewport>({ cellSize: 1, originX: 0, originY: 0 })
  const size = shallowRef<ViewSize>({ width: 0, height: 0, dpr: 1 })
  const chart = computed(() => state.value.chart)
  let fitted = false

  function fit() {
    if (size.value.width === 0 || size.value.height === 0) return
    viewport.value = fitViewport(chart.value, size.value)
    fitted = true
  }

  function setSize(next: ViewSize) {
    size.value = next
    if (!fitted) fit()
  }

  function zoom(
    direction: 1 | -1,
    anchorX = size.value.width / 2,
    anchorY = size.value.height / 2,
  ) {
    viewport.value = zoomAt(viewport.value, direction, anchorX, anchorY, chart.value, size.value)
  }

  function scroll(dx: number, dy: number) {
    viewport.value = scrollBy(viewport.value, dx, dy, chart.value, size.value)
  }

  watch(chart, fit)

  return {
    viewport,
    size,
    zoomPercent: computed(() => zoomPercent(viewport.value)),
    setSize,
    fit,
    zoomIn: () => zoom(1),
    zoomOut: () => zoom(-1),
    zoom,
    scroll,
  }
}

export type ChartView = ReturnType<typeof useChartView>
