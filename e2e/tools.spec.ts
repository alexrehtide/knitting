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

test('a rectangle dragged with R paints its outline in the current yarn, its middle stays empty', async ({
  page,
}) => {
  await page.goto('./')
  const status = page.getByRole('contentinfo', { name: 'Статус' })
  const center = await cellCenter(page, 7, 8)
  const empty = await probe(page, center)
  const corners = [
    await cellCenter(page, 5, 5),
    await cellCenter(page, 5, 12),
    await cellCenter(page, 10, 5),
    await cellCenter(page, 10, 12),
  ]
  const side = await cellCenter(page, 5, 8)
  const [from, , , to] = corners

  await page.keyboard.press('KeyR')
  await page.mouse.move(from!.x, from!.y)
  await page.mouse.down()
  await page.mouse.move(to!.x, to!.y, { steps: 5 })
  await expect(status.getByText('8 × 6', { exact: true })).toBeVisible()
  // The preview is on the overlay: the chart itself changes on release.
  expect(await probe(page, side)).toEqual(empty)
  await page.mouse.up()

  for (const corner of corners) await expect.poll(() => probe(page, corner)).toEqual(CURRENT_YARN)
  expect(await probe(page, side)).toEqual(CURRENT_YARN)
  expect(await probe(page, center)).toEqual(empty)
  await expect(status.getByText('8 × 6', { exact: true })).toBeHidden()
})

test('E picks the eraser, shown in the tool column and the status bar', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Кисть' })).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('KeyE')

  await expect(page.getByRole('button', { name: 'Ластик' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Инструмент: Ластик')).toBeVisible()
})
