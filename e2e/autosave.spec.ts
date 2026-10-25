import { expect, test, type Page } from '@playwright/test'
import { cellCenter, probe } from './chart'

const WHITE = [255, 255, 255]

async function paint(page: Page, row: number, stitch: number) {
  const point = await cellCenter(page, row, stitch)
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.up()
}

/**
 * Reads a slot of the autosave as src/infrastructure/indexedDbAutosave.ts keeps it,
 * or writes it when `value` is given.
 */
function slot(page: Page, key: 'autosave' | 'autosave-broken', value?: unknown) {
  return page.evaluate(
    ([key, value, write]) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('knitting', 1)
        open.onupgradeneeded = () => open.result.createObjectStore('autosave')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const transaction = database.transaction('autosave', write ? 'readwrite' : 'readonly')
          const store = transaction.objectStore('autosave')
          const request = write ? store.put(value, key) : store.get(key)
          transaction.oncomplete = () => {
            database.close()
            resolve(request.result)
          }
          transaction.onerror = () => reject(transaction.error)
        }
      }),
    [key, value, value !== undefined] as const,
  )
}

/** Waits until the autosave holds the chart with the mark of changes not in a file as given. */
async function autosaved(page: Page, unsavedToFile: boolean) {
  await expect
    .poll(
      async () => ((await slot(page, 'autosave')) as { unsavedToFile?: boolean })?.unsavedToFile,
    )
    .toBe(unsavedToFile)
}

const status = (page: Page) => page.getByRole('contentinfo', { name: 'Статус' })
const unsavedLabel = (page: Page) => status(page).getByText('не в файле', { exact: true })

test('a drawn chart and its mark of changes not in a file survive a reload; after saving to a file the mark does not', async ({
  page,
}) => {
  await page.goto('./')
  await paint(page, 1, 1)
  await autosaved(page, true)

  await page.reload()
  await expect.poll(async () => probe(page, await cellCenter(page, 1, 1))).toEqual(WHITE)
  await expect(unsavedLabel(page)).toBeVisible()

  const download = page.waitForEvent('download')
  await page.keyboard.press('Control+KeyS')
  await download
  await autosaved(page, false)

  await page.reload()
  await expect.poll(async () => probe(page, await cellCenter(page, 1, 1))).toEqual(WHITE)
  await expect(unsavedLabel(page)).toBeHidden()
  await expect(status(page).getByText('сохранено', { exact: true })).toBeVisible()
})

test('after an edit and a reload «Открыть» asks to save the changes to a file', async ({
  page,
}) => {
  await page.goto('./')
  await paint(page, 1, 1)
  await autosaved(page, true)

  await page.reload()
  await page.getByRole('button', { name: 'Файл' }).click()
  await page.getByRole('menuitem', { name: 'Открыть .kchart…' }).click()

  await expect(page.getByRole('dialog', { name: 'Сохранить изменения в файл?' })).toBeVisible()
})

test('a broken record gives an empty chart, a toast to download it as it is, and a copy in «autosave-broken»', async ({
  page,
}) => {
  const broken = { document: { format: 'kchart', version: 1 }, unsavedToFile: true }
  await page.goto('./')
  await slot(page, 'autosave', broken)

  await page.reload()
  const toast = page.getByRole('region').getByRole('listitem').filter({
    hasText: 'Не удалось восстановить схему',
  })
  await expect(toast).toBeVisible()
  await expect(status(page).getByText('Размер: 40 × 40')).toBeVisible()
  await expect(unsavedLabel(page)).toBeHidden()
  expect(await slot(page, 'autosave-broken')).toEqual(broken)
  expect(await slot(page, 'autosave')).toBeUndefined()

  const download = page.waitForEvent('download')
  await toast.getByRole('button', { name: 'Скачать как есть' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('autosave-broken.json')
})

test('failing writes say so in the status bar and once in a toast, and closing the page warns', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const failures = window as unknown as { autosaveFailures: number }
    failures.autosaveFailures = 0
    IDBObjectStore.prototype.put = function () {
      failures.autosaveFailures++
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }
  })
  await page.goto('./')

  await paint(page, 1, 1)
  await expect(status(page).getByText('автосохранение не работает', { exact: true })).toBeVisible()
  await paint(page, 1, 2)
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { autosaveFailures: number }).autosaveFailures),
    )
    .toBe(2)
  await expect(
    page.getByText('Автосохранение не работает: сохраните схему в файл', { exact: true }),
  ).toHaveCount(1)

  const dialog = page.waitForEvent('dialog')
  await page.close({ runBeforeUnload: true })
  const warning = await dialog
  expect(warning.type()).toBe('beforeunload')
  await warning.accept()
})

test('the tool and the line highlight flag survive a reload', async ({ page }) => {
  await page.goto('./')
  // The editor mounts once the autosave is read: keys before that go nowhere.
  await expect(status(page).getByText('Инструмент: Кисть')).toBeVisible()
  await page.keyboard.press('KeyE')
  await expect(status(page).getByText('Инструмент: Ластик')).toBeVisible()
  await page.getByRole('button', { name: 'Вид' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Подсветка ряда и столбца' }).click()
  await page.keyboard.press('Escape')

  await page.reload()

  await expect(status(page).getByText('Инструмент: Ластик')).toBeVisible()
  await page.getByRole('button', { name: 'Вид' }).click()
  await expect(
    page.getByRole('menuitemcheckbox', { name: 'Подсветка ряда и столбца' }),
  ).toHaveAttribute('aria-checked', 'false')
})
