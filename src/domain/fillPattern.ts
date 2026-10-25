/** Fill patterns in assignment order; the codes are also the `.kchart` pattern codes (spec, «Файл схемы .kchart»). */
export const FILL_PATTERNS = [
  'cross',
  'circle-filled',
  'circle-outline',
  'plus',
  'square-filled',
  'line-slash',
  'triangle-up-outline',
  'diamond-filled',
  'line-h',
  'square-outline',
  'line-backslash',
  'triangle-down-filled',
  'line-v',
  'diamond-outline',
  'circle-dot',
  'asterisk',
] as const

export type FillPattern = (typeof FILL_PATTERNS)[number]

/** A point of the unit cell square, y down. */
export type PatternPoint = readonly [x: number, y: number]

/**
 * A vector primitive of a pattern in the unit cell square; widths and radii are in cell fractions.
 * The square stretches with the cell, so at a cell aspect other than 1:1 a circle is an ellipse.
 */
export type PatternPrimitive =
  | {
      readonly kind: 'segment'
      readonly from: PatternPoint
      readonly to: PatternPoint
      readonly width: number
    }
  | { readonly kind: 'disc'; readonly center: PatternPoint; readonly radius: number }
  | {
      readonly kind: 'circle'
      readonly center: PatternPoint
      readonly radius: number
      readonly width: number
    }
  | { readonly kind: 'polygon'; readonly points: readonly PatternPoint[] }
  | {
      readonly kind: 'polyline'
      readonly points: readonly PatternPoint[]
      readonly width: number
      readonly closed: boolean
    }

const segment = (from: PatternPoint, to: PatternPoint, width: number): PatternPrimitive => ({
  kind: 'segment',
  from,
  to,
  width,
})
const disc = (center: PatternPoint, radius: number): PatternPrimitive => ({
  kind: 'disc',
  center,
  radius,
})
const circle = (center: PatternPoint, radius: number, width: number): PatternPrimitive => ({
  kind: 'circle',
  center,
  radius,
  width,
})
const polygon = (...points: PatternPoint[]): PatternPrimitive => ({ kind: 'polygon', points })
const outline = (width: number, ...points: PatternPoint[]): PatternPrimitive => ({
  kind: 'polyline',
  points,
  width,
  closed: true,
})

/**
 * One icon in the middle of the cell for each pattern, as the prototype of «Библиотека узоров заливки» (#6)
 * printed them; the canvas and the PDF draw from these alike.
 */
export const PATTERN_SHAPES: Readonly<Record<FillPattern, readonly PatternPrimitive[]>> = {
  cross: [segment([0.25, 0.25], [0.75, 0.75], 0.1), segment([0.75, 0.25], [0.25, 0.75], 0.1)],
  'circle-filled': [disc([0.5, 0.5], 0.2)],
  'circle-outline': [circle([0.5, 0.5], 0.24, 0.09)],
  plus: [segment([0.22, 0.5], [0.78, 0.5], 0.1), segment([0.5, 0.22], [0.5, 0.78], 0.1)],
  'square-filled': [polygon([0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7])],
  'line-slash': [segment([0.25, 0.75], [0.75, 0.25], 0.12)],
  'triangle-up-outline': [outline(0.09, [0.5, 0.24], [0.78, 0.74], [0.22, 0.74])],
  'diamond-filled': [polygon([0.5, 0.2], [0.8, 0.5], [0.5, 0.8], [0.2, 0.5])],
  'line-h': [segment([0.22, 0.5], [0.78, 0.5], 0.12)],
  'square-outline': [outline(0.09, [0.28, 0.28], [0.72, 0.28], [0.72, 0.72], [0.28, 0.72])],
  'line-backslash': [segment([0.25, 0.25], [0.75, 0.75], 0.12)],
  'triangle-down-filled': [polygon([0.22, 0.28], [0.78, 0.28], [0.5, 0.78])],
  'line-v': [segment([0.5, 0.22], [0.5, 0.78], 0.12)],
  'diamond-outline': [outline(0.09, [0.5, 0.2], [0.8, 0.5], [0.5, 0.8], [0.2, 0.5])],
  'circle-dot': [circle([0.5, 0.5], 0.28, 0.08), disc([0.5, 0.5], 0.09)],
  asterisk: [
    segment([0.28, 0.28], [0.72, 0.72], 0.08),
    segment([0.72, 0.28], [0.28, 0.72], 0.08),
    segment([0.5, 0.2], [0.5, 0.8], 0.08),
    segment([0.2, 0.5], [0.8, 0.5], 0.08),
  ],
}

/** Below this relative luminance of the yarn colour the icon over it is white (spec, «Холст»). */
const WHITE_INK_BELOW = 0.18

/** The icon colour over a yarn colour `#rrggbb` in «цвет+узор»: black over light yarns, white over dark. */
export function patternInk(color: string): 'black' | 'white' {
  return relativeLuminance(color) < WHITE_INK_BELOW ? 'white' : 'black'
}

/** WCAG relative luminance of `#rrggbb`. */
function relativeLuminance(color: string): number {
  const rgb = Number.parseInt(color.slice(1), 16)
  const [r, g, b] = [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff].map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
