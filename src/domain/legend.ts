import type { Palette, Yarn } from './palette'
import type { StitchCounts } from './stitchCount'

export interface LegendEntry {
  /** The yarn number: its position in the palette, from 1. */
  readonly number: number
  readonly yarn: Yarn
  readonly stitches: number
}

/** The legend of the title sheet: palette order, yarns with no stitches left out, numbers kept with gaps. */
export function legend(palette: Palette, counts: StitchCounts): LegendEntry[] {
  return palette.flatMap((yarn, i) => {
    const stitches = counts.get(yarn.id) ?? 0
    return stitches > 0 ? [{ number: i + 1, yarn, stitches }] : []
  })
}
