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

/** Drops the yarn; the rest keep their order. */
export function removeYarn(palette: Palette, id: YarnId): Palette {
  return palette.filter((y) => y.id !== id)
}

/**
 * Why a yarn of the palette cannot be removed, or `null` if it can: the palette is never empty.
 * A used yarn can, with a replacement for its cells (yarnReplacement.ts).
 */
export function yarnRemovalBlock(palette: Palette): 'last-yarn' | null {
  return palette.length <= 1 ? 'last-yarn' : null
}

/** What a yarn edit changes; a field left out stays as it is. */
export interface YarnChanges {
  readonly color?: string
  /** `null` — «без узора». */
  readonly pattern?: FillPattern | null
  readonly name?: string
}

/** The palette with the yarn's colour, pattern or name changed, the yarn in the same place. */
export function updateYarn(palette: Palette, id: YarnId, changes: YarnChanges): Palette {
  return palette.map((y) => (y.id === id ? { ...y, ...changes } : y))
}

/** How many yarns have each pattern; patterns nobody has and «без узора» are not in it. */
export function patternUses(palette: Palette): ReadonlyMap<FillPattern, number> {
  const uses = new Map<FillPattern, number>()
  for (const y of palette)
    if (y.pattern !== null) uses.set(y.pattern, (uses.get(y.pattern) ?? 0) + 1)
  return uses
}

/** How many yarns share their pattern with another yarn, for the warning «у N нитей совпадают узоры». */
export function patternClashCount(palette: Palette): number {
  let count = 0
  for (const yarns of patternUses(palette).values()) if (yarns > 1) count += yarns
  return count
}

/** `#rrggbb` or `#rgb` in any case, with or without `#`, as a yarn colour; `null` if it is not one. */
export function parseYarnColor(text: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())
  if (!match?.[1]) return null
  const hex = match[1].toLowerCase()
  return `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`
}

/** The first unused pattern in assignment order; if all are taken, the first of the least used. */
function autoPattern(palette: Palette): FillPattern {
  const uses = patternUses(palette)
  let best: FillPattern = FILL_PATTERNS[0]
  for (const p of FILL_PATTERNS) if ((uses.get(p) ?? 0) < (uses.get(best) ?? 0)) best = p
  return best
}
