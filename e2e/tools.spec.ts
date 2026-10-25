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

test('a fill inside a closed brush frame paints the inside only', async ({ page }) => {
  await page.goto('./')
  const inside = await cellCenter(page, 7, 7)
  const outside = await cellCenter(page, 12, 12)
  const empty = await probe(page, outside)

  // The frame in the previous yarn (black), so the fill in the current one (white) shows apart.
  const corners = [
    [5, 5],
    [5, 10],
    [10, 10],
    [10, 5],
    [5, 5],
  ] as const
  const points = []
  for (const [row, stitch] of corners) points.push(await cellCenter(page, row, stitch))
  const [first, ...rest] = points
  await page.mouse.move(first!.x, first!.y)
  await page.mouse.down({ button: 'right' })
  for (const point of rest) await page.mouse.move(point.x, point.y, { steps: 5 })
  await page.mouse.up({ button: 'right' })

  await page.keyboard.press('KeyG')
  await page.mouse.move(inside.x, inside.y)
  await page.mouse.down()
  await page.mouse.up()

  await expect.poll(() => probe(page, inside)).toEqual(CURRENT_YARN)
  await expect.poll(async () => probe(page, await cellCenter(page, 9, 6))).toEqual(CURRENT_YARN)
  expect(await probe(page, outside)).toEqual(empty)
  expect(await probe(page, await cellCenter(page, 4, 4))).toEqual(empty)
})

test('E picks the eraser, shown in the tool column and the status bar', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Кисть' })).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('KeyE')

  await expect(page.getByRole('button', { name: 'Ластик' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Инструмент: Ластик')).toBeVisible()
})
