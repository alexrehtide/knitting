import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

/** Opens the yarn editor of yarn `number`, presses the pattern button `name` and closes the editor. */
async function choosePattern(page: Page, number: number, name: string) {
  await page.getByRole('button', { name: `Изменить нить ${number}` }).click()
  const button = page.getByRole('button', { name, exact: true })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(button).toBeHidden()
}

test('two yarns with one pattern raise the warning; another pattern drops it and goes to the file', async ({
  page,
}) => {
  await page.goto('./')
  const alert = page.getByText('у 2 нитей совпадают узоры')
  const tab = page.getByRole('tab', { name: /Палитра/ })
  await expect(tab).toHaveText('Палитра')

  // The default yarns are × and ●: yarn 2 takes × too.
  await choosePattern(page, 2, 'Крест')
  await expect(alert).toBeVisible()
  await expect(tab).toHaveText('Палитра2')
  const rows = page.getByRole('list', { name: 'Нити палитры' }).getByRole('listitem')
  await expect(rows.getByRole('img', { name: 'Узор совпадает с другой нитью' })).toHaveCount(2)

  await choosePattern(page, 1, 'Плюс')
  await expect(alert).toBeHidden()
  await expect(tab).toHaveText('Палитра')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Файл' }).click()
  await page.getByRole('menuitem', { name: 'Сохранить в файл .kchart' }).click()
  const { palette } = JSON.parse(await readFile(await (await download).path(), 'utf-8'))
  expect(palette.map((y: { pattern: string | null }) => y.pattern)).toEqual(['plus', 'cross'])
})
