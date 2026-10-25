import type { Chart, ChartProperties } from './chart'
import type { PropertiesPatch } from './patch'

/** The properties the user edits; the dates are kept by the editor itself. */
export type PropertyChanges = Partial<Omit<ChartProperties, 'createdAt' | 'modifiedAt'>>

/** Why a property edit is refused. */
export type PropertyError = 'gauge-not-positive' | 'major-step-below-one' | 'aspect-not-positive'

const positive = (n: number) => Number.isFinite(n) && n > 0

/** Why the changes cannot be made, or `null` if they can (docs/spec.md, «Схема»). */
export function propertyError(changes: PropertyChanges): PropertyError | null {
  const { gauge, majorStep, cellAspect } = changes
  if (gauge && (!positive(gauge.stitches) || !positive(gauge.rows))) return 'gauge-not-positive'
  if (majorStep !== undefined && !(Number.isInteger(majorStep) && majorStep >= 1))
    return 'major-step-below-one'
  if (cellAspect?.mode === 'manual' && !positive(cellAspect.ratio)) return 'aspect-not-positive'
  return null
}

/**
 * Cell width / height. In «авто» a stitch is 10 / stitches cm wide and a row 10 / rows cm high,
 * so the ratio is rows / stitches.
 */
export function cellAspectRatio({ cellAspect, gauge }: ChartProperties): number {
  return cellAspect.mode === 'auto' ? gauge.rows / gauge.stitches : cellAspect.ratio
}

/** «Готовое полотно ≈ X × Y см»: the chart knitted at the gauge, in cm. */
export function finishedSize(
  chart: Pick<Chart, 'width' | 'height'>,
  gauge: ChartProperties['gauge'],
): { width: number; height: number } {
  return { width: (chart.width / gauge.stitches) * 10, height: (chart.height / gauge.rows) * 10 }
}

/** The patch that makes the changes, holding only the properties that differ; `null` when none do. */
export function propertiesPatch(
  properties: ChartProperties,
  changes: PropertyChanges,
): PropertiesPatch | null {
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(changes)) {
    const old = properties[key as keyof PropertyChanges]
    if (value === undefined || sameValue(value, old)) continue
    before[key] = old
    after[key] = value
  }
  if (Object.keys(after).length === 0) return null
  return {
    kind: 'properties',
    before: before as PropertyChanges,
    after: after as PropertyChanges,
  }
}

/** Property values are strings, numbers and flat objects of them. */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return a === b
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k])
  )
}
