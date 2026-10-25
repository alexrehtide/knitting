import { expect, type Page } from '@playwright/test'

/**
 * Finds the chart on the canvas as the box of pixels that differ from the corner (outside the chart),
 * in canvas device px.
 */
export async function chartBox(page: Page) {
  return page.getByTestId('chart-canvas').evaluate((el) => {
    const canvas = el as HTMLCanvasElement
    const { width, height } = canvas
    const data = canvas.getContext('2d')!.getImageData(0, 0, width, height).data
    const outside = [data[0], data[1], data[2]]
    let left = width
    let top = height
    let right = -1
    let bottom = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (data[i] === outside[0] && data[i + 1] === outside[1] && data[i + 2] === outside[2])
          continue
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
    return { left, top, width: right - left + 1, height: bottom - top + 1 }
  })
}

/**
 * The chart canvas pixel of the cell centred at a page point, `inset` cells in from its top left corner:
 * clear of the cell's hatch line and grid lines, and at the default also of the yarn 2 icon (●).
 */
export async function probe(
  page: Page,
  point: { x: number; y: number; cell: number },
  inset = 0.25,
) {
  const box = await page.getByTestId('chart-canvas').boundingBox()
  if (!box) throw new Error('No chart on the page')
  const x = Math.round(point.x - box.x - point.cell * (0.5 - inset))
  const y = Math.round(point.y - box.y - point.cell * (0.5 - inset))
  return page
    .getByTestId('chart-canvas')
    .evaluate(
      (el, [px, py]) =>
        [...(el as HTMLCanvasElement).getContext('2d')!.getImageData(px!, py!, 1, 1).data].slice(
          0,
          3,
        ),
      [x, y],
    )
}

/** Margin around the chart after «Вписать», as in src/presentation/canvas/viewport.ts. */
const FIT_MARGIN = 16

/** The chart's numbering direction, as in `ChartProperties.numbering`. */
export interface Numbering {
  readonly rows: 'bottom-up' | 'top-down'
  readonly stitches: 'right-to-left' | 'left-to-right'
}

/**
 * The page point at the centre of a cell named in the numbering (by default rows bottom up,
 * stitches right to left), after «Вписать» at `deviceScaleFactor: 1` with square cells. Found from
 * the canvas `boundingBox` and the chart size in the status bar; hovers it and checks the status
 * bar names it.
 */
export async function cellCenter(
  page: Page,
  row: number,
  stitch: number,
  numbering: Numbering = { rows: 'bottom-up', stitches: 'right-to-left' },
) {
  const status = page.getByRole('contentinfo', { name: 'Статус' })
  const size = (await status.getByText(/^Размер: \d+ × \d+$/).textContent())?.match(/(\d+) × (\d+)/)
  const box = await page.getByTestId('chart-canvas').boundingBox()
  if (!size || !box) throw new Error('No chart on the page')
  const [width, height] = [Number(size[1]), Number(size[2])]

  const cell = Math.floor(
    Math.min((box.width - 2 * FIT_MARGIN) / width, (box.height - 2 * FIT_MARGIN) / height),
  )
  const left = box.x + Math.round((box.width - width * cell) / 2)
  const top = box.y + Math.round((box.height - height * cell) / 2)
  const column = numbering.stitches === 'right-to-left' ? width - stitch : stitch - 1
  const gridRow = numbering.rows === 'bottom-up' ? height - row : row - 1
  const point = { x: left + (column + 0.5) * cell, y: top + (gridRow + 0.5) * cell }

  await page.mouse.move(point.x, point.y)
  await expect(status.getByText(`ряд ${row}, петля ${stitch}`, { exact: true })).toBeVisible()
  return { ...point, cell, box }
}
