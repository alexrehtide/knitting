import { expect, test } from '@playwright/test'
import { cellCenter, probe } from './chart'

const RED = [255, 0, 0]

test('a new yarn with a hex colour paints the chart; its row counts the stitches', async ({
  page,
}) => {
  await page.goto('./')
  const palette = page.getByRole('list', { name: 'Нити палитры' })

  await page.getByRole('button', { name: 'Добавить нить' }).click()
  await page.getByRole('button', { name: 'Изменить нить 3' }).click()
  const hex = page.getByRole('textbox', { name: 'Цвет (hex)' })
  await hex.fill('#FF0000')
  await hex.press('Enter')
  // A click outside closes the popover and goes to the row under it.
  await palette.getByRole('button', { name: 'Нить 3: без имени' }).click()
  await expect(hex).toBeHidden()
  await expect(page.getByText('Нить: 3')).toBeVisible()

  const start = await cellCenter(page, 2, 2)
  const end = await cellCenter(page, 2, 4)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y)
  await page.mouse.up()

  await expect.poll(async () => probe(page, await cellCenter(page, 2, 3))).toEqual(RED)
  await expect(palette.getByRole('listitem').nth(2)).toContainText('3 петли')
  await expect(palette.getByRole('listitem').nth(0)).toContainText('0 петель')
})

test('a click on the chart with the yarn editor open closes it and paints', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Изменить нить 1' }).click()
  const hex = page.getByRole('textbox', { name: 'Цвет (hex)' })
  await expect(hex).toBeVisible()

  const cell = await cellCenter(page, 3, 3)
  await page.mouse.click(cell.x, cell.y)

  await expect(hex).toBeHidden()
  await expect.poll(() => probe(page, cell)).toEqual([255, 255, 255])
})

test('the eyedropper takes the yarn of a cell and gives the brush back', async ({ page }) => {
  await page.goto('./')
  const cell = await cellCenter(page, 4, 4)
  await page.mouse.click(cell.x, cell.y, { button: 'right' })

  await page.keyboard.press('KeyI')
  await expect(page.getByText('Инструмент: Пипетка')).toBeVisible()
  await page.mouse.click(cell.x, cell.y)

  await expect(page.getByText('Нить: 2')).toBeVisible()
  await expect(page.getByText('Инструмент: Кисть')).toBeVisible()
})
