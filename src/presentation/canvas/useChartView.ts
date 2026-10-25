import { computed, ref, shallowRef, watch, type ShallowRef } from 'vue'
import type { EditorState } from '../../application/editorSession'
import type { Viewport, ViewSize } from '../../application/chartRenderer'
import { cellAspectRatio } from '../../domain/chartProperties'
import { numberOfCell } from '../../domain/numbering'
import { cellAt, fitViewport, scrollBy, unboundedCellAt, zoomAt, zoomPercent } from './viewport'

/**
 * Zoom, scroll and the pointer over the canvas. They are view state, not edits, so they live here
 * rather than in the session. The view fits the chart when the canvas first gets a size, whenever
 * the chart is replaced and whenever its cell aspect changes.
 */
export function useChartView(state: ShallowRef<EditorState>) {
  const viewport = shallowRef<Viewport>({ cellWidth: 1, cellHeight: 1, originX: 0, originY: 0 })
  const size = shallowRef<ViewSize>({ width: 0, height: 0, dpr: 1 })
  const chart = computed(() => state.value.chart)
  // A property patch gives the same chart new properties.
  const properties = computed(() => state.value.chart.properties)
  const aspect = computed(() => cellAspectRatio(properties.value))
  /** The pointer over the canvas in CSS px, or `null` when it is elsewhere. */
  const pointer = shallowRef<{ x: number; y: number } | null>(null)
  /** «Вид» → «Подсветка ряда и столбца». */
  const lineHighlight = ref(true)
  let fitted = false

  // From the pointer rather than stored, so it follows zoom and scroll under a still pointer.
  const hoverCell = computed(() =>
    pointer.value ? cellAt(viewport.value, chart.value, pointer.value.x, pointer.value.y) : null,
  )
  const hoverNumber = computed(() =>
    hoverCell.value
      ? numberOfCell({ ...chart.value, properties: properties.value }, hoverCell.value)
      : null,
  )

  function fit() {
    if (size.value.width === 0 || size.value.height === 0) return
    viewport.value = fitViewport(chart.value, size.value, aspect.value)
    fitted = true
  }

  function setSize(next: ViewSize) {
    size.value = next
    if (!fitted) fit()
  }

  function setPointer(next: { x: number; y: number } | null) {
    pointer.value = next
  }

  function setLineHighlight(enabled: boolean) {
    lineHighlight.value = enabled
  }

  function zoom(
    direction: 1 | -1,
    anchorX = size.value.width / 2,
    anchorY = size.value.height / 2,
  ) {
    viewport.value = zoomAt(
      viewport.value,
      direction,
      anchorX,
      anchorY,
      chart.value,
      size.value,
      aspect.value,
    )
  }

  function scroll(dx: number, dy: number) {
    viewport.value = scrollBy(viewport.value, dx, dy, chart.value, size.value)
  }

  watch([chart, aspect], fit)

  return {
    viewport,
    size,
    zoomPercent: computed(() => zoomPercent(viewport.value)),
    hoverCell,
    hoverNumber,
    lineHighlight: computed(() => lineHighlight.value),
    setSize,
    setPointer,
    setLineHighlight,
    fit,
    zoomIn: () => zoom(1),
    zoomOut: () => zoom(-1),
    zoom,
    scroll,
    /** The cell under a canvas point in CSS px, on the grid or off it, for the gesture. */
    gestureCellAt: (x: number, y: number) => unboundedCellAt(viewport.value, x, y),
  }
}

export type ChartView = ReturnType<typeof useChartView>
