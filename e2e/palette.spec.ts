import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { cellCenter, probe } from './chart'

const RED = [255, 0, 0]

/** «Сохранить в файл» from the menu; returns the downloaded document. */
async function savedDocument(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Файл' }).click()
  await page.getByRole('menuitem', { name: 'Сохранить в файл .kchart' }).click()
  return JSON.parse(await readFile(await (await download).path(), 'utf-8')) as {
    palette: { color: string }[]
    grid: { rows: number[][] }
  }
}

/** Presses the handle ⋮⋮ of the yarn and moves the pointer to the top quarter of the row `to`. */
async function dragYarn(page: Page, number: number, to: number) {
  const rows = page.getByRole('list', { name: 'Нити палитры' }).getByRole('listitem')
  const handle = await page.getByLabel(`Переставить нить ${number}`).boundingBox()
  const target = await rows.nth(to - 1).boundingBox()
  if (!handle || !target) throw new Error('No palette rows')
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 4, { steps: 5 })
}

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

test('removing a used yarn replaces its cells; Ctrl+Z brings back the cells and the yarn', async ({
  page,
}) => {
  await page.goto('./')
  const palette = page.getByRole('list', { name: 'Нити палитры' })
  // Yarn 2 (black) on the right button.
  const start = await cellCenter(page, 3, 2)
  const end = await cellCenter(page, 3, 4)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(end.x, end.y)
  await page.mouse.up({ button: 'right' })
  const middle = await cellCenter(page, 3, 3)
  await expect.poll(() => probe(page, middle)).toEqual([0, 0, 0])

  await page.getByRole('button', { name: 'Изменить нить 2' }).click()
  await page.getByRole('button', { name: 'Удалить' }).click()
  const dialog = page.getByRole('dialog', { name: 'Замена нити' })
  await expect(dialog).toContainText('3 петли')
  await dialog.getByRole('button', { name: 'Нить 1: без имени' }).click()
  await dialog.getByRole('button', { name: 'Заменить и удалить' }).click()

  await expect(dialog).toBeHidden()
  await expect.poll(() => probe(page, middle)).toEqual([255, 255, 255])
  await expect(palette.getByRole('listitem')).toHaveCount(1)
  await expect(palette.getByRole('listitem').nth(0)).toContainText('3 петли')

  await page.keyboard.press('Control+z')
  await expect.poll(() => probe(page, middle)).toEqual([0, 0, 0])
  await expect(palette.getByRole('listitem')).toHaveCount(2)
  await expect(
    palette.getByRole('listitem').nth(1).getByRole('button', { name: 'Нить 2: без имени' }),
  ).toBeVisible()
  await expect(palette.getByRole('listitem').nth(1)).toContainText('3 петли')
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

test('dragging yarn 2 above yarn 1 swaps their numbers in the file; the canvas stays the same', async ({
  page,
}) => {
  await page.goto('./')
  const palette = page.getByRole('list', { name: 'Нити палитры' })
  const white = await cellCenter(page, 1, 1)
  await page.mouse.click(white.x, white.y)
  const black = await cellCenter(page, 1, 2)
  await page.mouse.click(black.x, black.y, { button: 'right' })
  await expect.poll(() => probe(page, black)).toEqual([0, 0, 0])
  const before = await savedDocument(page)
  const probes = [await probe(page, white), await probe(page, black)]
  const indicator = palette.getByRole('separator', { name: 'Место вставки' })

  // Esc lets go of the yarn where it was.
  await dragYarn(page, 2, 1)
  await expect(indicator).toBeVisible()
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(indicator).toBeHidden()
  await expect(palette.getByRole('listitem').nth(0)).toContainText('1 петля')

  await dragYarn(page, 2, 1)
  await page.mouse.up()

  await expect(page.getByText('Нить: 2')).toBeVisible()
  const after = await savedDocument(page)
  expect(after.palette.map((y) => y.color)).toEqual(before.palette.map((y) => y.color).reverse())
  // Rows are [yarn, count, …]: every yarn number 1 becomes 2 and 2 becomes 1.
  const swapped = before.grid.rows.map((row) =>
    row.map((value, i) => (i % 2 === 0 && value > 0 ? 3 - value : value)),
  )
  expect(after.grid.rows).toEqual(swapped)
  expect([await probe(page, white), await probe(page, black)]).toEqual(probes)

  // Key 1 now takes the black yarn, which the brush paints.
  await page.keyboard.press('Digit1')
  await expect(page.getByText('Нить: 1')).toBeVisible()
  const painted = await cellCenter(page, 2, 1)
  await page.mouse.click(painted.x, painted.y)
  await expect.poll(() => probe(page, painted)).toEqual([0, 0, 0])
})
