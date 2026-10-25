import { expect, test, type Page } from '@playwright/test'

async function zoomPercent(page: Page) {
  const text = await page.getByText(/^Масштаб: \d+%$/).textContent()
  return Number(text?.match(/\d+/)?.[0])
}

test('? opens the shortcut help, built from the command registry', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('img', { name: 'Схема' })).toBeVisible()

  await page.keyboard.press('Shift+Slash')

  const help = page.getByRole('dialog', { name: 'Горячие клавиши' })
  await expect(help).toBeVisible()
  await expect(help.getByRole('row', { name: 'Вписать' })).toContainText(/Ctrl\s*0/)
})

test('the help opens from the «Справка» menu', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('button', { name: 'Справка' }).click()
  await page.getByRole('menuitem', { name: 'Горячие клавиши' }).click()

  await expect(page.getByRole('dialog', { name: 'Горячие клавиши' })).toBeVisible()
})

test('Ctrl+= does not zoom while the help is open', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText(/^Масштаб: \d+%$/)).toBeVisible()
  const before = await zoomPercent(page)
  await page.keyboard.press('Shift+Slash')
  const help = page.getByRole('dialog', { name: 'Горячие клавиши' })
  await expect(help).toBeVisible()

  await page.keyboard.press('Control+Equal')
  await page.keyboard.press('Escape')
  await expect(help).toBeHidden()

  expect(await zoomPercent(page)).toBe(before)
  // The same key works again once the help is closed.
  await page.keyboard.press('Control+Equal')
  await expect.poll(() => zoomPercent(page)).toBeGreaterThan(before)
})
