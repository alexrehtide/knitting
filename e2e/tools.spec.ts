import { expect, test } from '@playwright/test'
import { cellCenter, probe } from './chart'

/** Yarn 1 of the default palette, the current yarn at start. */
const CURRENT_YARN = [255, 255, 255]

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
