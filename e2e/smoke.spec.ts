import { expect, test } from '@playwright/test'

test('editor opens with the chart canvas', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByRole('img', { name: 'Схема' })).toBeVisible()
})
