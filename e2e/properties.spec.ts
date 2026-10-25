import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { cellCenter, chartBox } from './chart'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('Размер: 40 × 40')).toBeVisible()
  await page.getByRole('tab', { name: 'Схема' }).click()
})

const panel = (page: Page) => page.getByRole('complementary', { name: 'Панель' })

test('numbering «сверху вниз, слева направо» puts row 1, stitch 1 in the top left corner', async ({
  page,
}) => {
  await panel(page).getByRole('radio', { name: 'сверху вниз, слева направо' }).click()

  const first = await cellCenter(page, 1, 1, { rows: 'top-down', stitches: 'left-to-right' })
  const grid = await chartBox(page)
  expect(first.x - (first.box.x + grid.left)).toBeGreaterThan(0)
  expect(first.x - (first.box.x + grid.left)).toBeLessThan(first.cell)
  expect(first.y - (first.box.y + grid.top)).toBeGreaterThan(0)
  expect(first.y - (first.box.y + grid.top)).toBeLessThan(first.cell)

  // Undo brings back the knitter's numbering: row 1, stitch 1 at the bottom right.
  await page.keyboard.press('Control+KeyZ')
  await cellCenter(page, 1, 1)
})

test('the title names the chart in the menu bar and the saved file, which holds the properties', async ({
  page,
}) => {
  const title = panel(page).getByRole('textbox', { name: 'Название' })
  await title.fill('Олени')
  await title.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Олени •')

  const step = panel(page).getByRole('textbox', { name: 'Шаг выделения' })
  await step.fill('5')
  await step.blur()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Файл' }).click()
  await page.getByRole('menuitem', { name: 'Сохранить в файл .kchart' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('Олени.kchart')
  const { properties } = JSON.parse(await readFile(await file.path(), 'utf-8'))
  expect(properties).toMatchObject({ title: 'Олени', majorStep: 5 })
})

test('a gauge of 0 shows an error in the field and makes no edit', async ({ page }) => {
  const stitches = panel(page).getByRole('textbox', { name: 'Петель на 10 см' })
  await expect(panel(page).getByText('Готовое полотно ≈ 20 × 14,3 см')).toBeVisible()

  await stitches.fill('0')
  await stitches.press('Enter')

  await expect(panel(page).getByText('Плотность должна быть больше 0')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Без названия')
})

test('cells follow the cell aspect from the gauge', async ({ page }) => {
  const square = await chartBox(page)
  expect(square.width).toBe(square.height)

  await panel(page).getByRole('radio', { name: 'Авто' }).click()

  // 20 × 28 per 10 cm: a cell 1.4 times as wide as it is high.
  await expect
    .poll(async () => {
      const box = await chartBox(page)
      return Math.round((box.width / box.height) * 10) / 10
    })
    .toBe(1.4)
})
