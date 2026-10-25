# Рендеринг canvas для сетки 500×500

Исследование по тикету [#5](https://github.com/alexrehtide/knitting/issues/5). Вопрос: какой подход к рендерингу холста даёт плавную работу на **схеме** до 500×500 (250 000 **клеток**) при зуме, панорамировании и рисовании. Отдельно: слои, OffscreenCanvas, кэш тайлов, devicePixelRatio, **узоры заливки** на разных зумах, пороги скрытия узоров и линий сетки, **линейки** (canvas или DOM). Итог — рекомендуемая архитектура рендерера и бюджет кадра.

Термины — по [CONTEXT.md](../../CONTEXT.md). Ограничения — из [spec.md](../spec.md) и [ADR-0002](../adr/0002-framework-independent-core.md): сетка хранится как плоский `Uint16Array` (0 — пустая клетка), domain не импортирует canvas, рендерер живёт в infrastructure. Браузеры: последние две версии Chrome, Edge, Firefox, Safari.

## Коротко

1. **Цвет клеток** держать в отдельном bitmap 500×500, где одна клетка — один пиксель. Он заполняется через `Uint32Array` и таблицу «нить → RGBA», правки докладываются точечно. На экран bitmap выводится одним `drawImage` с `imageSmoothingEnabled = false`. Это меньше 1 мс на кадр при любом зуме, включая «вся схема в окне».
2. **Узоры заливки** показывать, только когда клетка не меньше ~8 CSS px. Растрить их в кэш экранных тайлов (на текущем зуме) и при панорамировании просто копировать тайлы. Рисовать узоры прямо в кадре нельзя: это 10–40 мс.
3. **Линии сетки** рисовать каждый кадр одним путём, только видимые. Скрывать их при клетке меньше ~4 CSS px. Линии **шага выделения** оставлять до ~2 px.
4. **Слои**: основной canvas (клетки, узоры, сетка; `alpha: false`) и верхний overlay-canvas (подсветка ряда и столбца под курсором, предпросмотр фигуры, ховер кисти). Линейки — два отдельных узких canvas.
5. **Перерисовка**: весь видимый кадр из кэшей, не больше одного раза за `requestAnimationFrame` и только по флагу «грязно». Dirty-rect нужен только на уровне кэшей (bitmap и тайлы), а не экрана.
6. **OffscreenCanvas в воркере не нужен**: кадр из кэшей занимает около 2–3 мс на главном потоке. Кэши можно делать через `OffscreenCanvas` без воркера.
7. **devicePixelRatio**: буфер равен CSS-размеру × dpr, `setTransform(dpr, …)`. Смену dpr ловить через `matchMedia`, смену размера — через `ResizeObserver`. Шаги зума квантовать так, чтобы клетка была целым числом **device**-пикселей.
8. **Бюджет кадра** 16,7 мс (60 Гц). Цель для рендера — не больше 4 мс. Запекание тайлов идёт отдельными порциями по ≤ 6 мс за кадр.

Подробности и обоснование ниже.

## Замеры

Чтобы сравнить подходы, сделан одноразовый бенчмарк: [canvas-rendering-bench.html](canvas-rendering-bench.html). Это не код приложения. Условия: headless Chrome 155, Windows 11, вьюпорт 1600×1000 при dpr 1. Сетка 500×500 с 30 нитями: полосы плюс 15% случайного шума, то есть это худший случай для слияния одинаковых клеток. Время — среднее за кадр, синхронизация через `getImageData(0,0,1,1)`.

Абсолютные цифры в headless (вероятно, программная растеризация) хуже, чем в реальном браузере с GPU. Здесь важны соотношения между подходами, а не сами числа. Перед этапом 1 стоит повторить замер в настоящих Chrome, Firefox и Safari.

| Клетка, CSS px | Видимых клеток | A: `fillRect` на клетку | A2: слияние в полосы + `Path2D` на цвет | **B: bitmap 1 клетка = 1 px + `drawImage`** | Сетка (1 путь) | Узоры: `fill` с `CanvasPattern` | Узоры: JS-растр в `ImageData` | Узоры: копирование кэш-тайлов |
|---|---|---|---|---|---|---|---|---|
| 2 | 250 000 | 92–146 мс | 20 мс | **0,5–0,8 мс** | — | — | — | — |
| 4 | 100 000 | 41–43 мс | 9,7 мс | **0,6 мс** | — | — | — | — |
| 8 | 25 000 | 10,6 мс | 3,3 мс | **0,5 мс** | 0,8 мс | 16–20 мс | 11 мс | **0,5–0,8 мс** |
| 16 | 6 300 | 3,0 мс | 1,4 мс | **0,6 мс** | 0,5 мс | 14–19 мс | 9 мс | **0,5–1,1 мс** |
| 32 | 1 600 | 1–1,9 мс | 0,7–1,6 мс | **0,5–1,0 мс** | 0,2–0,4 мс | 13–38 мс | 9–15 мс | **0,5–0,8 мс** |

Ещё несколько замеров:

- Полная пересборка bitmap 500×500 (цикл по `Uint16Array` → `Uint32Array` через таблицу, затем `putImageData`) — 1,4–1,7 мс. Обновить одну клетку можно `putImageData` с dirty-прямоугольником 1×1, это ~0 мс.
- Запекание тайлов узоров на весь видимый экран: 8–50 мс при клетке 8 px, 4–37 мс при 32 px (разброс зависит от GPU-флагов). Это стоимость смены зума, а не кадра.
- Отрисовка клеток «штампом» (заранее отрисованный canvas клетки, `drawImage` на каждую клетку) — 7–88 мс. Как способ рисовать каждый кадр не годится, годится только для запекания.
- Линейка: `fillText` 200 меток на canvas 3200×48 — 0,47 мс, 30 меток — 0,06 мс.

Выводы из замеров:

- Рисовать каждую клетку отдельным вызовом (A) нельзя: при отдалении это 40–150 мс. Вариант A2 тоже не помещается в бюджет на мелком зуме, а именно на мелком зуме видна вся схема.
- Вариант B почти не зависит от зума и числа клеток, потому что браузер масштабирует одну картинку. Это та же идея, что в MDN-советах «pre-render on an offscreen canvas» и «render only the differences» ([MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)).
- Стоимость `fill` с `CanvasPattern` зависит от закрашиваемой площади в пикселях, а не от числа клеток, поэтому она не падает при приближении. Узоры нужно кэшировать.

## Слой клеток: bitmap «клетка = пиксель»

- Offscreen-холст W×H (до 500×500, это 1 МБ RGBA) и `ImageData` с видом `Uint32Array` на его буфер. Таблица `rgba[yarnIndex]` пересчитывается при изменении **палитры**, индекс 0 (**пустая клетка**) — белый. Порядок байтов в `Uint32Array` на всех целевых платформах little-endian: `0xAABBGGRR`.
- При правке клеток в bitmap пишутся только изменённые индексы. Их даёт патч правки ([ADR-0001](../adr/0001-undo-via-reversible-patches.md): `(индекс, было, стало)`). Затем вызывается `putImageData(img, 0, 0, dx, dy, dw, dh)` по ограничивающему прямоугольнику. `putImageData` не зависит от матрицы трансформации, `globalAlpha` и композиции: пиксели заменяются целиком ([HTML spec, pixel manipulation](https://html.spec.whatwg.org/multipage/canvas.html#pixel-manipulation)). Поэтому писать в bitmap надо без трансформаций.
- Изменение палитры (цвет нити, **замена нити**) и undo большой правки требуют полной пересборки, но это всего ~1,5 мс.
- Вывод на экран: `ctx.imageSmoothingEnabled = false; ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh)` только для видимого диапазона клеток. Спецификация требует при `imageSmoothingEnabled = false` увеличивать изображение по ближайшему соседу ([HTML spec, image smoothing](https://html.spec.whatwg.org/multipage/canvas.html#image-smoothing); [MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled)). Флаг входит в состояние контекста, а изменение `width`/`height` холста сбрасывает состояние ([HTML spec: «Reset the rendering context to its default state»](https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-set-bitmap-dimensions)). Значит, после ресайза флаг нужно выставлять заново.
- **Пропорция клетки** сюда ложится естественно: `dw = cols × cellW`, `dh = rows × cellH`, и масштабы по осям могут различаться.
- **Квантование зума.** При ближайшем соседе и дробном размере клетки в device-пикселях клетки получаются неровными: ширина «гуляет» на ±1 px. На мелком зуме это незаметно, на крупном выглядит как кривая сетка. Поэтому дискретные шаги зума стоит выбирать так, чтобы `cellW × dpr` и `cellH × dpr` были целыми, а смещение панорамирования округлять до device-пикселя. MDN отдельно советует целые координаты, чтобы избежать субпиксельного сглаживания ([MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)).

## Узоры заливки

### Как рисовать

- **Узор заливки** лучше описать в domain как набор векторных примитивов в единичном квадрате клетки: линии штриховки, точки, крест. Это чистые данные без canvas, поэтому ADR-0002 не нарушается. Одно и то же описание рисуют и canvas-рендерер, и векторный PDF (спека требует PDF без растра). Тогда экран и печать совпадают.
- Узор привязан к клетке и масштабируется вместе с ней: при любом зуме внутри клетки один и тот же рисунок, как на печати. Обычный `CanvasPattern` с `repeat` к клетке не привязан: его начало — начало координат, к нему применяются матрица паттерна и текущая матрица ([HTML spec, patterns](https://html.spec.whatwg.org/multipage/canvas.html#canvaspattern)). Привязать можно через `CanvasPattern.setTransform()` (Baseline, Safari 11.1+; [MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasPattern/setTransform)) с периодом, равным клетке. Но в замерах заливка паттерном стоит 13–38 мс на экран, поэтому годится только для запекания.
- Практичный путь — **штампы**. Для каждой пары (узор, размер клетки в device px) один раз растрируется маленький canvas клетки: фон цвета нити и сверху векторный узор. Режим «только узор» даёт белый фон, «цвет+узор» — цветной. Затем штампы копируются `drawImage` в тайлы. Совет MDN «не масштабируйте в `drawImage`, кэшируйте нужные размеры заранее» относится как раз к этому ([MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)).

### Кэш тайлов

- Тайл — квадрат фиксированного **экранного** размера, например 512×512 device px. В нём `512 / cellPx` клеток, и тайл запечён под текущий зум. Если делать тайл фиксированным в клетках, на крупном зуме он раздувается: 64 клетки × 32 px = 2048² px = 16 МБ.
- Ключ тайла — `(zoomLevel, tx, ty, displayMode)`. LRU с лимитом около 2 экранов: при dpr 2 и окне 1600×1000 экран занимает 3200×2000×4 ≈ 25 МБ, значит лимит ~50 МБ. Тайлы вне экрана и других зумов вытесняются.
- **Правка клетки** перерисовывает её штамп в затронутом тайле, это ~0 мс. Изменение палитры или **режима отображения** сбрасывает кэш.
- **Во время зума** (Ctrl+колесо) тайлы старого уровня рисуются растянутыми, а свежий bitmap цвета уже даёт корректную картинку. После паузы ~100–150 мс тайлы нового уровня запекаются порциями, не больше ~6 мс за кадр, сначала видимые.
- **При панорамировании** тайлы просто копируются (0,5–1 мс). Недостающие края допекаются в фоне, пока поверх виден bitmap цвета.

### Пороги

Порог — по **меньшей** стороне клетки в CSS px с учётом пропорции. Значения стоит вынести в константы и подобрать на глаз на этапе 2.

| Размер клетки | Что видно |
|---|---|
| < 2 px | только bitmap цвета; линии сетки и шага выделения скрыты |
| 2–4 px | bitmap цвета + линии **шага выделения** |
| 4–8 px | + все линии сетки |
| ≥ 8 px | + узоры заливки (в режимах «узор» и «цвет+узор») |

Если узоры скрыты, режим «узор» на мелком зуме показывает клетки серой заливкой пропорционально плотности узора или просто цветом. Это решение UX, его нужно принять отдельно, на рендерер оно не влияет.

8 px — нижняя граница, при которой 12–16 узоров из библиотеки ещё различимы: на 8×8 пикселях есть место для штриховки с шагом 2–3 px. Число эмпирическое, не из источника.

## Линии сетки

- Каждый кадр рисуются заново, отдельными путями для обычных линий и линий шага выделения: один `beginPath`, много `moveTo/lineTo`, один `stroke`. Только видимые линии; в замере это 0,2–0,8 мс. MDN советует собирать вызовы в пакеты и избегать лишних смен состояния ([MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)).
- Чёткость: штрих центрирован на пути, так что линия толщиной 1 device px должна лежать на полупикселе ([MDN: Applying styles — lineWidth](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors)). Сетку проще рисовать в device-пикселях (`setTransform(1,0,0,1,0,0)`) по координатам `round(x × dpr) + 0.5`. Альтернатива — `fillRect` шириной 1 device px.
- Сетку не стоит запекать в тайлы. Тогда она не дублируется в кэше и её можно отключить без сброса кэша.

## Слои

| Слой | Что | Когда перерисовывается |
|---|---|---|
| bitmap цвета (offscreen) | 1 клетка = 1 px | точечно по патчам правок; целиком при смене палитры |
| тайлы узоров (offscreen) | штампы клеток на текущем зуме | лениво, порциями; по правкам — точечно |
| **основной canvas** (`alpha: false`) | фон → bitmap цвета → тайлы узоров → сетка | целиком, ≤ 1 раза за rAF, если грязно (вьюпорт, правка) |
| **overlay canvas** (прозрачный, сверху) | подсветка ряда/столбца под курсором, ховер-клетка, предпросмотр линии и прямоугольника | на `pointermove`, очищается и рисуется заново (десятки примитивов) |
| линейки X/Y (2 canvas) | номера петель и рядов, подсветка под курсором | на смену вьюпорта и позиции курсора |

- Холсты разного назначения разнесены и наложены через CSS, как советует MDN («use multiple layered canvases for complex scenes»). `alpha: false` на основном холсте позволяет браузеру оптимизировать композицию ([MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas); [HTML spec, `CanvasRenderingContext2DSettings`](https://html.spec.whatwg.org/multipage/canvas.html#canvasrenderingcontext2dsettings)).
- Overlay нужен, чтобы движение мыши без нажатия не трогало основной холст. Кадр основного холста дешёвый, около 2 мс, так что и без overlay всё бы работало, но разделение упрощает логику «что грязно».
- **Предпросмотр мазка кисти** отдельного слоя не требует. Клетки мазка сразу пишутся в сетку (через сценарий application) и докладываются в bitmap, а правкой для undo мазок становится при отпускании. Предпросмотр **линии** и **прямоугольника** идёт в overlay, пока жест не завершён.

### Почему не dirty-rect на экране

Dirty-rect на основном холсте сэкономил бы ~2 мс, но сильно усложнил бы код: пересечения с overlay, панорамирование, линии сетки на границах. MDN предлагает «render only the differences», но в нашем случае различия уже учтены на уровне кэшей: точечные обновления bitmap и тайлов. Полный кадр из кэшей укладывается в бюджет с большим запасом.

## Цикл кадра и ввод

- Состояние рендерера — `dirty`-флаги: `viewport`, `cells(indices)`, `palette`, `displayMode`, `overlay`, `rulers`. Любое событие только ставит флаг и планирует один `requestAnimationFrame`. Вся отрисовка — внутри колбэка rAF ([MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) — «use `requestAnimationFrame()`»).
- Мазок кисти: на `pointermove` берутся `getCoalescedEvents()`, чтобы быстрый мазок не терял точки. API поддерживается в Chrome 58+, Firefox 59+, Safari 18.2+ ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents); [browser-compat-data](https://github.com/mdn/browser-compat-data)). Это укладывается в «последние две версии», но API доступен только в secure context: GitHub Pages и localhost подходят. Между точками всё равно нужна интерполяция Брезенхэмом из domain, как и сказано в спеке.
- `desynchronized: true` (low-latency canvas) не нужен. Он рассчитан на стилус, может давать разрывы изображения и не поддерживается Firefox ([Chrome for Developers](https://developer.chrome.com/blog/desynchronized); browser-compat-data).

## devicePixelRatio и размер

- Буфер холста: `canvas.width = round(cssWidth × dpr)`, CSS-размер — логический, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` ([MDN: devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio); [MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)).
- Смена dpr (зум страницы, перенос окна на другой монитор) ловится через `matchMedia('(resolution: Xdppx)')`, и подписка пересоздаётся при каждом срабатывании ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)). Смена dpr сбрасывает кэш тайлов и штампов: размер клетки в device px меняется.
- Размер контейнера отслеживается через `ResizeObserver`. Точный `devicePixelContentBoxSize` в Safari не поддерживается (browser-compat-data), поэтому достаточно `contentRect × dpr` с округлением.
- Ресайз сбрасывает состояние контекста и очищает буфер (HTML spec), поэтому после него заново выставляются трансформация и `imageSmoothingEnabled` и сразу рисуется кадр.

## OffscreenCanvas и воркер

- `OffscreenCanvas` и `transferControlToOffscreen()` поддерживаются во всех целевых браузерах: Chrome 69, Firefox 105, Safari 16.4 ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas); [web.dev](https://web.dev/articles/offscreen-canvas)). Рендер в воркере полезен, когда canvas-работа тяжёлая и мешает отзывчивости UI (web.dev).
- Нам это не нужно, причины такие:
  1. Кадр из кэшей занимает ~2–3 мс. Узкое место — запекание тайлов, но его можно делить на порции.
  2. Сетку пришлось бы синхронизировать с воркером. `SharedArrayBuffer` требует cross-origin isolation ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)), то есть заголовков COOP/COEP, а GitHub Pages не позволяет задавать свои заголовки ответа. Остаётся копировать патчи через `postMessage`, а это ещё один канал состояния.
  3. Подсветка курсора и предпросмотр фигур должны идти синхронно с вводом на главном потоке.
- `OffscreenCanvas` без воркера (`new OffscreenCanvas(w, h)`) удобен для bitmap, штампов и тайлов: он не требует DOM. Подойдёт и `document.createElement('canvas')`. Решение можно пересмотреть, если реальный профиль на этапе 2 покажет, что запекание мешает вводу.

## Линейки: canvas, а не DOM

- Два узких canvas (сверху и сбоку), закреплённые у краёв видимой области, с тем же учётом dpr. Рисуются только видимые метки, каждая N-я жирнее (**шаг выделения**), номер под курсором подсвечен. Нумерация следует **направлению нумерации** — это функция domain: `index → номер`.
- В замере `fillText` 30–200 меток стоит 0,06–0,5 мс. При отдалении, когда метки налезают друг на друга, остаются только метки шага выделения или каждая k-я метка, где k подбирается так, чтобы между метками было ≥ ~30 px.
- DOM-вариант, то есть абсолютно позиционированные `<span>`, пришлось бы виртуализировать (500 меток × 2) и сдвигать при каждом панорамировании. Это layout и style-recalc на каждом кадре и рассинхрон с canvas на кадр. MDN советует избегать текста в горячем цикле canvas, но здесь текста мало и он на отдельном холсте ([MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)). Доступность (номера для скринридера) в этом редакторе требуется только для статус-бара, а он остаётся DOM.

## Граница слоёв (ADR-0002)

- domain даёт данные: `Uint16Array` сетки, палитру, описания узоров (векторные примитивы в единичном квадрате), функции нумерации, список изменённых индексов в патче.
- application объявляет порт рендерера, например `ChartView`, с методами вида `setChart`, `cellsChanged(indices)`, `paletteChanged()`, `setDisplayMode()`, `setViewport()`, `setHover()` и `setPreview(shape)`. Преобразование «экран → клетка» для ввода можно держать в чистой функции над `Viewport` и тестировать без браузера.
- infrastructure реализует порт на canvas: bitmap, штампы, тайлы, сетка, overlay, линейки, rAF.
- Viewport (зум, смещение, квантование шагов) — чистая модель без DOM. Зум и прокрутка правками не являются (CONTEXT.md).

## Бюджет кадра

При 60 Гц на кадр 16,7 мс, а браузеру нужен свой запас на композицию, стили и ввод. Цель для нашего JS-рендера — **≤ 4 мс на кадр** на главном потоке. Ориентиры по замерам (headless, 1600×1000; при dpr 2 площадь в 4 раза больше, ожидается до ~2× дольше на блитах):

| Шаг кадра | Бюджет |
|---|---|
| обновить bitmap по патчу мазка (десятки клеток) | < 0,1 мс |
| `drawImage` bitmap цвета | ≤ 1 мс |
| копирование видимых тайлов узоров (если клетка ≥ 8 px) | ≤ 1 мс |
| линии сетки | ≤ 1 мс |
| overlay (курсор, предпросмотр) | ≤ 0,5 мс |
| линейки | ≤ 0,5 мс |
| **итого кадр** | **≤ 4 мс** |
| запекание тайлов (вне основного кадра, порциями) | ≤ 6 мс за rAF, пока очередь не пуста |
| полная пересборка bitmap (смена палитры, undo заливки) | ≤ 2 мс, разово |

Если в каком-то браузере кадр не укладывается, первым делом стоит уменьшить экранный размер тайла или порог узоров, а уже потом думать о воркере.

## Открытые вопросы для следующих этапов

- Повторить бенчмарк в реальных Chrome, Firefox и Safari с GPU и при dpr 2, затем уточнить пороги и бюджет.
- UX режима «узор» на зуме ниже порога: серый тон или цвет.
- PNG-экспорт может переиспользовать штампы и сетку, но рендерит в отдельный холст без кэша тайлов, целиком в нужном масштабе.

## Источники

- MDN — [Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- MDN — [Window.devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
- MDN — [CanvasRenderingContext2D.createPattern()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createPattern), [CanvasPattern.setTransform()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasPattern/setTransform)
- MDN — [imageSmoothingEnabled](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled)
- MDN — [Applying styles and colors (lineWidth)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors)
- MDN — [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- MDN — [PointerEvent.getCoalescedEvents()](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents)
- MDN — [SharedArrayBuffer: security requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- WHATWG HTML Living Standard — [The canvas element](https://html.spec.whatwg.org/multipage/canvas.html): `CanvasRenderingContext2DSettings`, установка размеров bitmap, паттерны, image smoothing, pixel manipulation
- web.dev — [OffscreenCanvas — speed up your canvas operations with a web worker](https://web.dev/articles/offscreen-canvas)
- Chrome for Developers — [Low-latency rendering with the desynchronized hint](https://developer.chrome.com/blog/desynchronized)
- [@mdn/browser-compat-data](https://github.com/mdn/browser-compat-data) 6.0.0 — версии поддержки `getCoalescedEvents`, `OffscreenCanvas`, `CanvasPattern.setTransform`, `devicePixelContentBoxSize`, `desynchronized`
- Собственный бенчмарк — [canvas-rendering-bench.html](canvas-rendering-bench.html)
