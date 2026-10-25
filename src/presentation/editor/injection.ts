import { inject, type InjectionKey } from 'vue'
import type { ChartRenderer } from '../../application/chartRenderer'
import type { EditorSession } from '../../application/editorSession'

/** Adapters come from `src/main.ts`; the renderer is made per canvas once it is mounted. */
export type ChartRendererFactory = (canvas: HTMLCanvasElement) => ChartRenderer

export const editorSessionKey: InjectionKey<EditorSession> = Symbol('editorSession')
export const chartRendererKey: InjectionKey<ChartRendererFactory> = Symbol('chartRenderer')

export function injectStrict<T>(key: InjectionKey<T>): T {
  const value = inject(key)
  if (value === undefined) throw new Error(`${String(key.description)} is not provided`)
  return value
}
