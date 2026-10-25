# Nuxt UI в Vue + Vite без Nuxt

Исследование к issue [#3](https://github.com/alexrehtide/knitting/issues/3). Дата: 2026-10-25.

**Вопрос.** Как подключить Nuxt UI (актуальная мажорная версия) в чистом Vue 3 + Vite + TS strict: установка, Tailwind v4, тема, тёмная тема. Как совмещается его локализация (русская локаль) с vue-i18n. Какие компоненты подходят для нашего UI. Есть ли ограничения рядом с полноэкранным `<canvas>` (порталы, перехват клавиш, focus trap). Как он влияет на размер бандла.

Источники: официальная документация (ui.nuxt.com), исходники опубликованного пакета `@nuxt/ui@4.12.0` и его зависимости `reka-ui@2.11.0` (смотрел `node_modules`), npm-реестр, релизы на GitHub. Размер бандла я **измерил сам** на пробной сборке (описание ниже).

## Кратко

- Nuxt UI **v4** (последняя `4.12.0` вышла 2026-10-15) официально поддерживает Vue + Vite без Nuxt. Подключается через Vite-плагин `@nuxt/ui/vite`, Vue-плагин `@nuxt/ui/vue-plugin` и CSS `@import "tailwindcss"; @import "@nuxt/ui";`. Лицензия MIT, бывшие Pro-компоненты теперь бесплатны.
- Tailwind v4 обязателен (peer `tailwindcss ^4`). Отдельно ставить `@tailwindcss/vite` не нужно: он идёт в зависимостях Nuxt UI.
- **Без vue-router нужен `router: false`**, иначе сборка падает (проверено).
- Русская локаль есть: `import { ru } from '@nuxt/ui/locale'` → `<UApp :locale="ru">`. С vue-i18n она не связана: это отдельный словарь внутренних строк компонентов. У нас один язык, поэтому достаточно передать `ru` статически.
- Нужные нам компоненты есть все, кроме ToggleGroup: `UColorPicker`, `UModal`, `UInputNumber`, `UButton` + `UFieldGroup`, `UTooltip` (с `kbds`), `UToast`/`useToast`, `UKbd`, `UPopover`. Тулбар-переключатели собираются из `UButton` с `active` внутри `UFieldGroup`.
- Рядом с canvas нужна осторожность: оверлеи рендерятся в портал `body`; модалка ставит `pointer-events: none` на body, держит фокус и слушает Escape на `window`, но **не останавливает всплытие** клавиш. Наш реестр горячих клавиш должен сам молчать, пока открыт оверлей или фокус в поле ввода.
- `defineShortcuts` из Nuxt UI для нашего реестра лучше не брать. Привязку по `event.code` он умеет (`layoutIndependent: true`), но реестр команд у нас свой (спека), и два глобальных слушателя `keydown` будут конфликтовать.
- Бандл (минимальное приложение с 8 компонентами, Vite 8): **JS ≈ 176 КБ gzip против ≈ 46 КБ** у голого Vue + vue-i18n, то есть **+≈130 КБ gzip**. CSS ≈ 11 КБ gzip с `experimental.componentDetection` (без него ≈ 24 КБ).

## 1. Версия и статус

- `@nuxt/ui` latest = `4.12.0`, опубликован 2026-10-15 ([npm](https://www.npmjs.com/package/@nuxt/ui), [релиз](https://github.com/nuxt/ui/releases/tag/v4.12.0)). Релизы минорных версий выходят примерно раз в месяц (4.9.0 — июнь, 4.10.0 — июль, 4.11.0 — август 2026).
- v4 объединил Nuxt UI и Nuxt UI Pro в один open-source пакет с лицензией MIT ([релиз v4.0.0](https://github.com/nuxt/ui/releases/tag/v4.0.0), лицензия в `gh api repos/nuxt/ui`).
- Компоненты построены на `reka-ui` (в 4.12.0 версия закреплена: `2.11.0`), стили на Tailwind v4 + `tailwind-variants`, иконки через `@iconify/vue`, цветовая тема через `@vueuse/core` (`dependencies` в npm).
- Peer-зависимости: `tailwindcss ^4`, `typescript ^5.6.3 || ^6 || ^7`, `vue-router ^4.5 || ^5` (optional), остальные optional (tiptap, zod и т.п.) — `npm view @nuxt/ui peerDependencies peerDependenciesMeta`.

## 2. Установка в Vue + Vite

По [Installation → Vue](https://ui.nuxt.com/docs/getting-started/installation/vue):

```bash
npm i @nuxt/ui tailwindcss
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

export default defineConfig({
  plugins: [
    vue(),
    ui({
      router: false,                               // у нас нет vue-router — см. ниже
      theme: { colors: ['primary', 'neutral', 'error'] }, // только нужные алиасы
      ui: { colors: { primary: 'indigo', neutral: 'zinc' } },
      icon: { clientBundle: { scan: true } },      // иконки в бандл, без Iconify API
      experimental: { componentDetection: true },  // CSS только используемых компонентов (4.11+)
    }),
  ],
})
```

```ts
// src/main.ts
import ui from '@nuxt/ui/vue-plugin'
import './assets/main.css'   // @import "tailwindcss"; @import "@nuxt/ui";
app.use(i18n).use(ui)
```

```vue
<!-- App.vue: UApp обязателен для Toast, Tooltip и программных оверлеев -->
<UApp :locale="ru"> … </UApp>
```

```html
<!-- index.html: класс isolate на корне обязателен -->
<div id="app" class="isolate"></div>
```

Подробности (все по той же странице, если не указано иное):

- **`isolate` на `#app`** обязателен. Без него оверлеи могут вести себя неправильно (stacking context).
- **`router`**. По умолчанию `true` и подключает обёртку `ULink` над `vue-router`. Опция `router?: boolean | 'inertia'` есть в типах (`dist/unplugin.d.mts`), `false` значит «обычные `<a>`». **Проверено:** без `vue-router` и без `router: false` сборка Vite 8 падает с `MISSING_EXPORT "useRoute" … __vite-optional-peer-dep:vue-router`.
- **Автоимпорт.** Плагин включает `unplugin-auto-import` и `unplugin-vue-components` и генерирует `auto-imports.d.ts` и `components.d.ts`. Их нужно добавить в `tsconfig.app.json → include` и в `.gitignore`. Если хочется явных импортов (лучше видно линтеру границ слоёв), используйте `components: false` / `autoImport: false` и импортируйте из `@nuxt/ui/components/Button.vue` и `@nuxt/ui/composables`.
- **TS / CI.** Файлы `.d.ts` появляются только после запуска Vite. Шаблон `create-vue` запускает `type-check` параллельно с `build`, и на чистом checkout это падает (`Cannot find name 'useToast'`). Документация советует `"build": "run-s build-only type-check"`. Это важно для нашего CI.
- Для автодополнения темы в `vite.config.ts` есть алиасы `#build/ui` → `./node_modules/.nuxt-ui/ui` (в `tsconfig.node.json` и `tsconfig.app.json`).
- **Иконки.** `UIcon` построен на `@iconify/vue`. Иконки коллекций, которые не установлены, грузятся **из Iconify API в рантайме** ([Icons → Vue](https://ui.nuxt.com/docs/getting-started/integrations/icons/vue)). Чтобы всё работало без сети, ставим `@iconify-json/lucide` и включаем `icon.clientBundle` (`icons: [...]` или `scan: true`). При сканировании учитываются только литеральные строки. **Проверено:** с `scan: true` SVG `lucide:eraser` и `lucide:brush` попали в JS-бандл.

## 3. Тема и тёмная тема

- **Цвета.** `ui({ ui: { colors: { primary, neutral } } })` задаёт семантические алиасы. `theme.colors` определяет, для каких алиасов генерируются варианты. Каждый алиас добавляет полный набор оттенков во все компоненты, поэтому лучше оставить только нужные (`error` обязателен, если есть формы). Источник: Installation → Vue, раздел опций.
- **CSS-переменные** для своих компонентов и canvas-рендера: `--ui-bg`, `--ui-bg-muted`, `--ui-bg-elevated`, `--ui-text`, `--ui-text-muted`, `--ui-border`, `--ui-primary`, `--ui-radius` и др. (сгенерированный `node_modules/.nuxt-ui/ui.css`). Рендерер холста может читать их через `getComputedStyle`, чтобы рамки и линейки совпадали с темой.
- **Тёмная тема** ([Color mode → Vue](https://ui.nuxt.com/docs/getting-started/integrations/color-mode/vue)). Vue-плагин сам вызывает `useDark()` из `@vueuse/core` (исходник `dist/runtime/vue/plugins/color-mode.js`). Это класс `dark` на `<html>`, режим `auto` по системной настройке, сохранение в `localStorage` (поведение по умолчанию VueUse `useDark`). Переключатель пишется через `useColorMode()` из `@vueuse/core` или готовые `UColorModeSwitch` / `UColorModeSelect` / `UColorModeButton`. Отключение: `colorMode: false`.
- Про мигание светлой темы при загрузке в документации для Vue ничего нет. Если понадобится, добавим маленький inline-скрипт в `index.html`, который ставит `dark` до монтирования (вывод, а не документированное поведение).

## 4. Локализация и vue-i18n

По [i18n → Vue](https://ui.nuxt.com/docs/getting-started/integrations/i18n/vue):

- Nuxt UI переводит только свои внутренние строки (aria-label «Закрыть», подписи календаря и т.п.). Их задаёт prop `locale` у `UApp`. Русская локаль есть: `dist/runtime/locale/ru.js`, `code: "ru"`, например `alert.close: "Закрыть"`.
- С vue-i18n он **не интегрирован**: два независимых словаря. В документации показано, как переключать локаль UI по текущей локали vue-i18n: `<UApp :locale="locales[locale]">`, где `locales = { ru, en }`. Импортировать стоит только используемые локали.
- `code` локали управляет форматированием дат и времени (Calendar/InputDate/InputTime). `dir` задаёт направление текста.
- `extendLocale(ru, { messages: {...} })` позволяет переопределить отдельные строки, `defineLocale` — создать свою локаль.
- **Для нас:** интерфейс только на русском, поэтому достаточно `<UApp :locale="ru">`. Все наши строки по-прежнему идут через vue-i18n (требование спеки). Подписи, которые мы передаём в props компонентов (`title`, `label`, `description` у toast), — это наши строки, и они берутся из `t()`.
- `UInputNumber` использует `NumberFieldRoot` из reka-ui с props `locale` и `formatOptions` (исходник `InputNumber.vue`). Это `Intl.NumberFormat`, так что запятую как десятичный разделитель для плотности даёт `locale="ru"`. Подхватывает ли компонент локаль из `UApp` автоматически, я не проверял; надёжнее передавать `locale="ru"` явно.

## 5. Компоненты под наш UI

Список компонентов взят из `dist/runtime/components` в 4.12.0.

| Потребность (спека) | Компонент | Замечания |
|---|---|---|
| Выбор цвета нити | `UColorPicker` (+ `UPopover`) | Область насыщенность/яркость + полоса оттенка. `format: 'hex' \| 'rgb' \| 'hsl' \| 'cmyk' \| 'lab'`, `throttle` (по умолчанию 50 мс), `defaultValue` `#FFFFFF`. Поля ввода hex и пипетки нет: hex-поле добавим своим `UInput` рядом. Сетку образцов палитры (~30 нитей) делаем сами. |
| Диалоги (новая схема, замена нити, «Сохранить / Отбросить / Отмена») | `UModal` или программно `useOverlay()` | Props `title`, `description`, `dismissible` (false — не закрывать по Esc и клику мимо, подходит для подтверждения), `portal`, `overlay`, `transition`, `fullscreen`. |
| Числовые поля (ширина/высота, плотность, N рядов) | `UInputNumber` | reka `NumberField`: `min`/`max`/`step`, кнопки ±, `formatOptions`, `locale`, `disableWheelChange`. |
| Тулбар инструментов, переключатель режима отображения | `UButton` (`active`, `activeColor`, `activeVariant`, `square`, `icon`) в `UFieldGroup` | Отдельного ToggleGroup в Nuxt UI нет (в reka-ui он есть). Для «один из N» можно взять `UTabs` (variant `pill`) или `URadioGroup`, но кнопки в группе ближе к тулбару. |
| Подсказки с клавишей | `UTooltip` (`text`, `kbds`) | Нужен `UApp`. |
| Toast (ошибка импорта, «сохранено») | `useToast().add({...})`, `UToaster` внутри `UApp` | `position` (по умолчанию `bottom-right`), `max` 5, `duration`, `progress`. |
| Справка по клавишам (`?`) | `UKbd` + `UModal` | `UKbd value="ctrl"` показывает «Ctrl» на Windows и ⌃/⌘ на macOS (`useKbd.js`). |
| Свойства схемы | `UFormField`, `UInput`, `UTextarea`, `USelect` | — |
| Меню «Файл» (экспорт/импорт/PDF) | `UDropdownMenu` (items с `kbds`) | — |

## 6. Рядом с полноэкранным `<canvas>`

Поведение оверлеев задаёт reka-ui. Ниже — что видно в исходниках `reka-ui@2.11.0` и Nuxt UI.

- **Порталы.** `UModal`, `UPopover`, `UTooltip`, `UToaster` и другие по умолчанию рендерятся в `body` (`portal: true`). Можно передать `portal` = селектор или элемент (`usePortal.js`). Канвас-контейнер не затрагивается, но z-index оверлеев должен быть выше холста; за это и отвечает `isolate` на `#app`.
- **Модалка блокирует холст.** `DialogContentModal` включает `trapFocus`, `disableOutsidePointerEvents` (на body ставится `pointer-events: none`), `useHideOthers` (aria-hidden для остального) и `useBodyScrollLock`. Пока диалог открыт, мазки по canvas невозможны, и нам это подходит. После закрытия фокус возвращается на триггер.
- **Escape.** `DismissableLayer` слушает `Escape` через `onKeyStroke` на `window` и закрывает только верхний слой. `stopPropagation` он не вызывает (`DismissableLayer.js`). Значит, наш глобальный слушатель тоже получит этот Escape. Если Escape у нас что-то значит (например, отмена фигуры), реестр должен его пропускать, пока открыт оверлей.
- **Клавиши внутри диалогов.** Наши хоткеи `Tab` (режим отображения), `1`–`9`, буквы инструментов и `Ctrl+Z` не должны срабатывать, когда фокус в `UInputNumber`/`UInput` или открыта модалка: иначе ввод «40» в поле ширины переключит нить, а Tab внутри диалога (по документации reka он двигает фокус) сменит режим. **Рекомендация:** реестр команд игнорирует событие, если `event.target` — input/textarea/contenteditable или находится внутри `[role="dialog"]`, а также если `event.defaultPrevented`. Можно добавить в реестр явный флаг «открыт оверлей».
- **Popover закрывается кликом по холсту, и этот же клик может нарисовать клетку.** Немодальный (по умолчанию) `UPopover` закрывается по `pointerdown` снаружи, а событие при этом доходит до canvas. Варианты: открыть popover с `modal` (prop `PopoverRootProps` из reka; блокирует внешние pointer events так же, как диалог) или игнорировать первый `pointerdown` после закрытия. Это вывод из устройства `DismissableLayer`, на практике не проверял.
- **`defineShortcuts`** ([документация](https://ui.nuxt.com/docs/composables/define-shortcuts), исходник `defineShortcuts.js`) вешает `keydown` на `window`, умеет `layoutIndependent: true` (сравнение по `event.code`, работает в русской раскладке) и по умолчанию не срабатывает в input. Но он сам вызывает `preventDefault` и не знает про наш единый реестр команд. **Рекомендация:** не использовать его для команд редактора. Реестр по `event.code` пишем свой (спека, раздел «Горячие клавиши»). Из Nuxt UI берём только отображение (`UKbd`, `kbds` в `UTooltip`/`UDropdownMenu`). Метки для справки генерируем из того же реестра.

## 7. Размер бандла

**Методика.** Пробное приложение: Vite 8.3.5, Vue 3.5.44, vue-i18n 11.4.16, `@nuxt/ui` 4.12.0, Tailwind 4.3.3. Использованы `UApp(ru)`, `UButton`, `UFieldGroup`, `UTooltip`, `UPopover` + `UColorPicker`, `UInputNumber`, `UKbd`, `UModal` и toast. Опции: `router: false`, `theme.colors: [primary, neutral, error]`, `icon.clientBundle.scan` с `@iconify-json/lucide`. Для сравнения — та же сборка без Nuxt UI (Vue + vue-i18n и одна кнопка).

| Сборка | JS (min / gzip) | CSS (min / gzip) |
|---|---|---|
| Vue + vue-i18n, без UI | 129 КБ / **46 КБ** | — |
| + Nuxt UI, без `componentDetection` | 526 + 25 КБ / **168 + 7,6 КБ** | 175 КБ / 24 КБ |
| + Nuxt UI, `experimental.componentDetection: true` | 526 + 25 КБ / **168 + 7,6 КБ** | 69 КБ / **11 КБ** |

- Nuxt UI добавляет **≈130 КБ gzip JS** даже на 8 компонентов. Сюда входят reka-ui, `tailwind-merge`, `@vueuse`, `@iconify/vue`, `motion-v`, `Intl`-форматирование NumberField. tiptap и редакторные части в бандл не попали (проверено grep по бандлу). Vite предупреждает о чанке > 500 КБ.
- `componentDetection` (4.11+, experimental) уменьшает CSS более чем вдвое. Новые компоненты подхватываются при следующем старте dev-сервера (документация).
- Для GitHub Pages и десктопа это приемлемо. Если захотим быстрее показывать холст, диалоги можно грузить лениво (`defineAsyncComponent`), документацию по `useLazyOverlay` я не изучал.

## Открытые вопросы и непроверенное

- `vue-tsc --noEmit` в strict-режиме на пробном проекте не запускал (поставился TypeScript 7, проверял только сборку). Проверить при создании каркаса.
- Наследует ли `UInputNumber` локаль из `UApp` — не проверено, передавать `locale` явно.
- Клик по холсту при открытом non-modal popover — вывод из исходников, проверить в прототипе.
- Мигание темы при загрузке в Vue-режиме не документировано.
