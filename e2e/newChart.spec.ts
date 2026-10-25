import { expect, test, type Page } from '@playwright/test'
import { cellCenter } from './chart'

const status = (page: Page) => page.getByRole('contentinfo', { name: 'Статус' })
const newChart = (page: Page) => page.getByRole('dialog', { name: 'Новая схема' })

async function paint(page: Page) {
  const cell = await cellCenter(page, 1, 1)
  await page.mouse.click(cell.x, cell.y)
}

test('after an edit Alt+N asks to save the changes, then «Новая схема» makes a clean 30 × 20 chart', async ({
  page,
}) => {
  await page.goto('./')
  await paint(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Без названия •')

  await page.keyboard.press('Alt+KeyN')
  const saveChanges = page.getByRole('dialog', { name: 'Сохранить изменения в файл?' })
  await saveChanges.getByRole('button', { name: 'Отбросить' }).click()

  await expect(newChart(page).getByText('Готовое полотно ≈ 20 × 14,3 см')).toBeVisible()
  await newChart(page).getByRole('spinbutton', { name: 'Ширина, петель' }).fill('30')
  await newChart(page).getByRole('spinbutton', { name: 'Высота, рядов' }).fill('20')
  await newChart(page).getByRole('button', { name: 'Создать' }).click()

  await expect(newChart(page)).toBeHidden()
  await expect(status(page).getByText('Размер: 30 × 20')).toBeVisible()
  await expect(status(page).getByText('не в файле', { exact: true })).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Без названия')
})

test('«Новая схема» from the menu of a clean chart opens the dialog at once; «Отмена» keeps the chart', async ({
  page,
}) => {
  await page.goto('./')

  await page.getByRole('button', { name: 'Файл' }).click()
  await page.getByRole('menuitem', { name: 'Новая схема…' }).click()
  await newChart(page).getByRole('spinbutton', { name: 'Ширина, петель' }).fill('30')
  await newChart(page).getByRole('button', { name: 'Отмена' }).click()

  await expect(newChart(page)).toBeHidden()
  await expect(status(page).getByText('Размер: 40 × 40')).toBeVisible()
})
