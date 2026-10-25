import { expect, test, type Page } from '@playwright/test'
import { cellCenter } from './chart'

/** Yarn 1 of the default palette, the current yarn at start. */
const CURRENT_YARN = [255, 255, 255]

/** The chart canvas pixel at a page point, clear of the cell's hatch line and grid lines. */
async function probe(page: Page, point: { x: number; y: number; cell: number }) {
  const box = await page.getByTestId('chart-canvas').boundingBox()
  if (!box) throw new Error('No chart on the page')
  const x = Math.round(point.x - box.x - point.cell / 4)
  const y = Math.round(point.y - box.y - point.cell / 4)
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

test('a brush stroke paints the current yarn; Ctrl+Z empties the cell, Ctrl+Y paints it again', async ({
  page,
}) => {
  await page.goto('./')
  const start = await cellCenter(page, 5, 5)
  const end = await cellCenter(page, 5, 10)
  await page.mouse.move(start.x, start.y)

  await page.mouse.down()
  await page.mouse.move(end.x, end.y)
  await page.mouse.up()

  const middle = await cellCenter(page, 5, 8)
  await expect.poll(() => probe(page, middle)).toEqual(CURRENT_YARN)

  await page.keyboard.press('Control+KeyZ')
  await expect.poll(() => probe(page, middle)).not.toEqual(CURRENT_YARN)

  await page.keyboard.press('Control+KeyY')
  await expect.poll(() => probe(page, middle)).toEqual(CURRENT_YARN)
})

test('E picks the eraser, shown in the tool column and the status bar', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Кисть' })).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('KeyE')

  await expect(page.getByRole('button', { name: 'Ластик' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Инструмент: Ластик')).toBeVisible()
})
