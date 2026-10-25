import { expect, test } from '@playwright/test'
import { cellCenter, chartBox } from './chart'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('Размер: 40 × 40')).toBeVisible()
  await page.keyboard.press('Control+Digit0')
})

test('row 1, stitch 1 is the bottom right cell and row 40, stitch 40 the top left', async ({
  page,
}) => {
  const first = await cellCenter(page, 1, 1)
  const last = await cellCenter(page, 40, 40)
  // The grid as drawn, at deviceScaleFactor 1 so canvas px are page px; its bold edge spills 1 px out.
  const grid = await chartBox(page)
  const left = first.box.x + grid.left
  const top = first.box.y + grid.top
  const right = left + grid.width
  const bottom = top + grid.height

  expect(right - first.x).toBeGreaterThan(0)
  expect(right - first.x).toBeLessThan(first.cell)
  expect(bottom - first.y).toBeGreaterThan(0)
  expect(bottom - first.y).toBeLessThan(first.cell)
  expect(last.x - left).toBeGreaterThan(0)
  expect(last.x - left).toBeLessThan(last.cell)
  expect(last.y - top).toBeGreaterThan(0)
  expect(last.y - top).toBeLessThan(last.cell)
})

test('the status bar is empty off the grid', async ({ page }) => {
  const status = page.getByRole('contentinfo', { name: 'Статус' })
  const { box } = await cellCenter(page, 1, 1)

  await page.mouse.move(box.x + 4, box.y + 4)

  await expect(status.getByText(/^ряд \d+, петля \d+$/)).toHaveCount(0)
})
