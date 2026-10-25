import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { cellCenter } from './chart'

const status = (page: Page) => page.getByRole('contentinfo', { name: 'Статус' })
const resize = (page: Page) => page.getByRole('dialog', { name: 'Размер схемы' })

test('cutting off the column with a painted cell warns, then «Обрезать и применить» leaves it out of the file', async ({
  page,
}) => {
  await page.goto('./')
  // Stitch 1 is the rightmost column.
  const cell = await cellCenter(page, 1, 1)
  await page.mouse.click(cell.x, cell.y)

  await page.getByRole('button', { name: 'Правка', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Размер схемы…' }).click()
  await resize(page).getByRole('spinbutton', { name: 'Справа, петель' }).fill('-1')

  await expect(resize(page).getByText('39 × 40')).toBeVisible()
  await expect(resize(page).getByText('Будет обрезана 1 непустая клетка')).toBeVisible()
  await resize(page).getByRole('button', { name: 'Обрезать и применить' }).click()

  await expect(resize(page)).toBeHidden()
  await expect(status(page).getByText('Размер: 39 × 40')).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Файл' }).click()
  await page.getByRole('menuitem', { name: 'Сохранить в файл .kchart' }).click()
  const { grid } = JSON.parse(await readFile(await (await download).path(), 'utf-8'))
  expect([grid.width, grid.height]).toEqual([39, 40])
  expect(new Set(grid.rows.map((row: number[]) => row.join()))).toEqual(new Set(['0,39']))
})

test('«Изменить размер…» in the «Схема» tab adds rows with no warning; one undo takes them back', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'Схема' }).click()
  await page.getByRole('button', { name: 'Изменить размер…' }).click()
  await resize(page).getByRole('spinbutton', { name: 'Сверху, рядов' }).fill('2')

  await expect(resize(page).getByText('40 × 42')).toBeVisible()
  await expect(resize(page).getByText(/обрез/)).toBeHidden()
  await resize(page).getByRole('button', { name: 'Применить' }).click()
  await expect(status(page).getByText('Размер: 40 × 42')).toBeVisible()

  await page.keyboard.press('Control+KeyZ')
  await expect(status(page).getByText('Размер: 40 × 40')).toBeVisible()
})
