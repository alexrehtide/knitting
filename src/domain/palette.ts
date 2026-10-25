import { FILL_PATTERNS, type FillPattern } from './fillPattern'

/** Stable yarn id stored in grid cells (ADR-0004); 0 means an empty cell. */
export type YarnId = number

export interface Yarn {
  readonly id: YarnId
  /** `#rrggbb`, lower case. */
  readonly color: string
  /** `null` — the user chose «без узора». */
  readonly pattern: FillPattern | null
  /** Yarn name or article; empty when not given. */
  readonly name: string
}

/** Yarns in palette order: the yarn number is the position, starting from 1. */
export type Palette = readonly Yarn[]

export type AddYarnResult =
  | { readonly ok: true; readonly palette: Palette; readonly yarn: Yarn }
  | { readonly ok: false; readonly code: 'palette-full' }

/** Most yarns a palette can hold: ids must fit the grid's `Uint16Array` next to 0 for an empty cell. */
export const MAX_PALETTE_SIZE = 65_535

/** Appends a yarn with the smallest free id. */
export function addYarn(palette: Palette, yarn: { color: string; name?: string }): AddYarnResult {
  if (palette.length >= MAX_PALETTE_SIZE) return { ok: false, code: 'palette-full' }
  const used = new Set(palette.map((y) => y.id))
  let id = 1
  while (used.has(id)) id++
  const added: Yarn = {
    id,
    color: yarn.color,
    pattern: autoPattern(palette),
    name: yarn.name ?? '',
  }
  return { ok: true, palette: [...palette, added], yarn: added }
}

/** The first unused pattern in assignment order; if all are taken, the first of the least used. */
function autoPattern(palette: Palette): FillPattern {
  const uses = new Map<FillPattern, number>(FILL_PATTERNS.map((p) => [p, 0]))
  for (const y of palette)
    if (y.pattern !== null) uses.set(y.pattern, (uses.get(y.pattern) ?? 0) + 1)
  let best: FillPattern = FILL_PATTERNS[0]
  for (const p of FILL_PATTERNS) if ((uses.get(p) ?? 0) < (uses.get(best) ?? 0)) best = p
  return best
}
