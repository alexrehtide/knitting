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
