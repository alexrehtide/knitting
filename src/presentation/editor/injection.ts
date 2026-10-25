import { inject, type InjectionKey } from 'vue'
import type { ChartFileFormat } from '../../application/chartFile'
import type { ChartRenderer } from '../../application/chartRenderer'
import type { EditorSession } from '../../application/editorSession'

/** The chart's canvas layers: the chart, a transparent overlay above it, and the rulers along its top and left. */
export interface ChartCanvases {
  readonly chart: HTMLCanvasElement
  readonly overlay: HTMLCanvasElement
  readonly rulerX: HTMLCanvasElement
  readonly rulerY: HTMLCanvasElement
}

/** Adapters come from `src/main.ts`; the renderer is made per canvas set once it is mounted. */
export type ChartRendererFactory = (canvases: ChartCanvases) => ChartRenderer

export const editorSessionKey: InjectionKey<EditorSession> = Symbol('editorSession')
export const chartRendererKey: InjectionKey<ChartRendererFactory> = Symbol('chartRenderer')
export const chartFileFormatKey: InjectionKey<ChartFileFormat> = Symbol('chartFileFormat')

export function injectStrict<T>(key: InjectionKey<T>): T {
  const value = inject(key)
  if (value === undefined) throw new Error(`${String(key.description)} is not provided`)
  return value
}
