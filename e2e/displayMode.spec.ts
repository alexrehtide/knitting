import { expect, test } from '@playwright/test'
import { cellCenter, probe } from './chart'

/** Yarn 2 of the default palette, the previous yarn at start. */
const BLACK = [0, 0, 0]
const WHITE = [255, 255, 255]
// Near the corner of the cell, clear of every icon, the hatch line and the grid lines.
const CORNER = 0.12
const CENTER = 0.5

test('«Узор» shows a white cell for a black yarn; Tab goes on to «Цвет+узор», kept after a reload', async ({
  page,
}) => {
  await page.goto('./')
  const cell = await cellCenter(page, 5, 5)
  expect(cell.cell).toBeGreaterThanOrEqual(8)
  await page.mouse.down({ button: 'right' })
  await page.mouse.up({ button: 'right' })
  await expect.poll(() => probe(page, cell, CORNER)).toEqual(BLACK)

  const modes = page.getByRole('group', { name: 'Режим отображения' })
  await modes.getByRole('button', { name: 'Узор', exact: true }).click()

  await expect(modes.getByRole('button', { name: 'Узор', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect.poll(() => probe(page, cell, CORNER)).toEqual(WHITE)
  // The yarn's ● in black in the middle of the cell.
  expect(await probe(page, cell, CENTER)).toEqual(BLACK)

  await page.keyboard.press('Tab')
  const colorPattern = modes.getByRole('button', { name: 'Цвет+узор' })
  await expect(colorPattern).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => probe(page, cell, CORNER)).toEqual(BLACK)
  // Over a black yarn the icon is white.
  expect(await probe(page, cell, CENTER)).toEqual(WHITE)

  await page.reload()
  await expect(colorPattern).toHaveAttribute('aria-pressed', 'true')
})
