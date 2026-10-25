import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { cellCenter, probe } from './chart'

const FIXTURES = join(import.meta.dirname, '../fixtures/kchart/v1')
const WHITE = [255, 255, 255]
const BLACK = [0, 0, 0]

async function paint(
  page: Page,
  from: [row: number, stitch: number],
  to: [row: number, stitch: number] = from,
  button: 'left' | 'right' = 'left',
) {
  const start = await cellCenter(page, ...from)
  const end = await cellCenter(page, ...to)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button })
  await page.mouse.move(end.x, end.y)
  await page.mouse.up({ button })
}

async function fileMenu(page: Page, item: 'Открыть .kchart…' | 'Сохранить в файл .kchart') {
  await page.getByRole('button', { name: 'Файл' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

/** «Сохранить в файл» from the menu; returns the downloaded file's name and text. */
async function saveFile(page: Page) {
  const download = page.waitForEvent('download')
  await fileMenu(page, 'Сохранить в файл .kchart')
  const file = await download
  return { name: file.suggestedFilename(), text: await readFile(await file.path(), 'utf-8') }
}

/** «Открыть» from the menu, with no changes to ask about, choosing `path`. */
async function openFile(page: Page, path: string) {
  const chooser = page.waitForEvent('filechooser')
  await fileMenu(page, 'Открыть .kchart…')
  await (await chooser).setFiles(path)
}

/** The stitch counts in the palette rows of yarns 1 and 2. */
async function expectStitchCounts(page: Page, counts: readonly [string, string]) {
  const rows = page.getByRole('list', { name: 'Нити палитры' }).getByRole('listitem')
  for (const [i, count] of counts.entries()) await expect(rows.nth(i)).toContainText(count)
}

const title = (page: Page) => page.getByRole('heading', { level: 1 })
const unsavedLabel = (page: Page) =>
  page.getByRole('contentinfo', { name: 'Статус' }).getByText('не в файле', { exact: true })

test('drawing, undo and redo survive a save to file and opening it in a fresh browser', async ({
  page,
  browser,
}, testInfo) => {
  await page.clock.install({ time: new Date('2026-10-25T10:00:00Z') })
  await page.goto('./')
  const empty = await probe(page, await cellCenter(page, 1, 2))
  /** Probes stitches 1–3 of row 1 and stitches 1–2 of row 2. */
  const probes = async (p: Page) => [
    await probe(p, await cellCenter(p, 1, 1)),
    await probe(p, await cellCenter(p, 1, 2)),
    await probe(p, await cellCenter(p, 1, 3)),
    await probe(p, await cellCenter(p, 2, 1)),
    await probe(p, await cellCenter(p, 2, 2)),
  ]
  const painted = [WHITE, empty, WHITE, BLACK, BLACK]

  await paint(page, [1, 1], [1, 3])
  await paint(page, [2, 1], [2, 2], 'right')
  await expect.poll(() => probes(page)).toEqual([WHITE, WHITE, WHITE, BLACK, BLACK])
  await expectStitchCounts(page, ['3 петли', '2 петли'])

  await page.keyboard.press('KeyE')
  await paint(page, [1, 2])
  await expect.poll(() => probes(page)).toEqual(painted)
  await expectStitchCounts(page, ['2 петли', '2 петли'])

  await page.keyboard.press('Control+KeyZ')
  await expect.poll(() => probes(page)).toEqual([WHITE, WHITE, WHITE, BLACK, BLACK])
  await expectStitchCounts(page, ['3 петли', '2 петли'])

  await page.keyboard.press('Control+KeyY')
  await expect.poll(() => probes(page)).toEqual(painted)
  await expectStitchCounts(page, ['2 петли', '2 петли'])

  const saved = await saveFile(page)
  expect(saved.name).toBe('схема.kchart')
  // Rows top first: row 1 is the last; stitch 1 is the rightmost cell.
  const { grid } = JSON.parse(saved.text)
  expect(grid.rows.slice(-2)).toEqual([
    [0, 38, 2, 2],
    [0, 37, 1, 1, 0, 1, 1, 1],
  ])

  const path = testInfo.outputPath(saved.name)
  await writeFile(path, saved.text)
  // A new context starts with clean storage.
  const context = await browser.newContext({ viewport: page.viewportSize(), deviceScaleFactor: 1 })
  const fresh = await context.newPage()
  // A later time: the file keeps its own dates.
  await fresh.clock.install({ time: new Date('2026-10-25T12:00:00Z') })
  await fresh.goto('./')
  await openFile(fresh, path)

  await expect.poll(() => probes(fresh)).toEqual(painted)
  await expectStitchCounts(fresh, ['2 петли', '2 петли'])
  expect((await saveFile(fresh)).text).toBe(saved.text)
  await context.close()
})

test('each broken sample says why in a toast and leaves the chart as it is', async ({ page }) => {
  await page.goto('./')
  await paint(page, [1, 1])
  await page.keyboard.press('Control+KeyS')
  await expect(unsavedLabel(page)).toBeHidden()
  const point = await cellCenter(page, 1, 1)

  for (const [name, message] of [
    ['broken-not-kchart', 'Это не файл схемы (.kchart)'],
    ['broken-newer-version', 'Файл создан более новой версией редактора'],
    ['broken-corrupt', 'Файл повреждён: ряд 2: длина 3 вместо 4'],
    ['broken-too-large', 'Схема слишком большая: максимум 500×500'],
    ['broken-too-many-yarns', 'Слишком много нитей: максимум 65 535'],
  ] as const) {
    await openFile(page, join(FIXTURES, `${name}.kchart`))

    await expect(page.getByText(message, { exact: true })).toBeVisible()
    await expect(page.getByText('Размер: 40 × 40')).toBeVisible()
    await expect(title(page)).toHaveText('Без названия')
    expect(await probe(page, point)).toEqual(WHITE)
  }
})

test('an edit marks the chart as not in a file until it is saved; undo after saving marks it again', async ({
  page,
}) => {
  await page.goto('./')
  await expect(title(page)).toHaveText('Без названия')
  await expect(unsavedLabel(page)).toBeHidden()

  await paint(page, [1, 1])
  await expect(title(page)).toHaveText('Без названия •')
  await expect(unsavedLabel(page)).toBeVisible()

  await saveFile(page)
  await expect(title(page)).toHaveText('Без названия')
  await expect(unsavedLabel(page)).toBeHidden()

  await page.keyboard.press('Control+KeyZ')
  await expect(unsavedLabel(page)).toBeVisible()
})

test.describe('«Открыть» with changes not in a file', () => {
  const deer = join(FIXTURES, 'valid-deer-4x2.kchart')
  const dialog = (page: Page) => page.getByRole('dialog', { name: 'Сохранить изменения в файл?' })

  test.beforeEach(async ({ page }) => {
    await page.goto('./')
    await paint(page, [1, 1])
    await fileMenu(page, 'Открыть .kchart…')
    await expect(dialog(page)).toBeVisible()
  })

  test('«Отмена» changes nothing', async ({ page }) => {
    let chooserOpened = false
    page.on('filechooser', () => (chooserOpened = true))

    await dialog(page).getByRole('button', { name: 'Отмена' }).click()
    await expect(dialog(page)).toBeHidden()

    await expect(unsavedLabel(page)).toBeVisible()
    expect(await probe(page, await cellCenter(page, 1, 1))).toEqual(WHITE)
    expect(chooserOpened).toBe(false)
  })

  test('is not closed by Escape', async ({ page }) => {
    await page.keyboard.press('Escape')

    await expect(dialog(page)).toBeVisible()
  })

  test('«Отбросить» goes on to open the file', async ({ page }) => {
    const chooser = page.waitForEvent('filechooser')
    await dialog(page).getByRole('button', { name: 'Отбросить' }).click()
    await (await chooser).setFiles(deer)

    await expect(title(page)).toHaveText('Олени')
    await expect(page.getByText('Размер: 4 × 2')).toBeVisible()
    await expect(unsavedLabel(page)).toBeHidden()
  })

  test('«Сохранить в файл» downloads the chart and goes on to open the file', async ({ page }) => {
    const download = page.waitForEvent('download')
    const chooser = page.waitForEvent('filechooser')
    await dialog(page).getByRole('button', { name: 'Сохранить в файл' }).click()

    expect((await download).suggestedFilename()).toBe('схема.kchart')
    await (await chooser).setFiles(deer)
    await expect(title(page)).toHaveText('Олени')
  })
})
