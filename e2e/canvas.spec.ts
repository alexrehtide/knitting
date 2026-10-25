import { expect, test, type Page } from '@playwright/test'
import { chartBox } from './chart'

const PALETTE = ['#ffffff', '#000000']
const CHART_SIZE = 40

async function pixel(page: Page, x: number, y: number) {
  return page
    .getByTestId('chart-canvas')
    .evaluate(
      (el, [px, py]) => [
        ...(el as HTMLCanvasElement).getContext('2d')!.getImageData(px!, py!, 1, 1).data,
      ],
      [x, y],
    )
}

function matches(rgba: number[], hex: string) {
  const rgb = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  return rgb.every((channel, i) => Math.abs(channel - rgba[i]!) <= 2)
}

async function zoomPercent(page: Page) {
  const text = await page.getByText(/^Масштаб: \d+%$/).textContent()
  return Number(text?.match(/\d+/)?.[0])
}

test('an empty cell after «Вписать» does not look like any palette yarn', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText(`Размер: ${CHART_SIZE} × ${CHART_SIZE}`)).toBeVisible()

  await page.getByRole('button', { name: 'Вид' }).click()
  await page.getByRole('menuitem', { name: 'Вписать' }).click()

  const box = await chartBox(page)
  const cell = box.width / CHART_SIZE
  expect(cell).toBeGreaterThanOrEqual(8)
  // Near the top left corner of cell (row 3, stitch 3 from the left), clear of the grid lines.
  const probe = await pixel(
    page,
    Math.round(box.left + 3.25 * cell),
    Math.round(box.top + 3.25 * cell),
  )

  for (const color of PALETTE)
    expect(matches(probe, color), `probe ${probe} vs ${color}`).toBe(false)
})

test('Ctrl+= zooms in', async ({ page }) => {
  await page.goto('./')
  const before = await zoomPercent(page)

  await page.keyboard.press('Control+Equal')

  await expect.poll(() => zoomPercent(page)).toBeGreaterThan(before)
})
