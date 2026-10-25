export const ru = {
  chart: {
    canvasLabel: 'Схема',
    untitled: 'Без названия',
    unsavedToFile: 'Есть изменения не в файле',
  },
  file: {
    error: {
      'not-kchart': 'Это не файл схемы (.kchart)',
      'newer-version': 'Файл создан более новой версией редактора',
      corrupt: 'Файл повреждён: {detail}',
      'too-large': 'Схема слишком большая: максимум 500×500',
      'too-many-yarns': 'Слишком много нитей: максимум 65 535',
    },
    corruption: {
      'invalid-field': 'поле {field}',
      'row-count': 'рядов {rows} вместо {expected}',
      'row-length': 'ряд {row}: длина {length} вместо {expected}',
      'yarn-number': 'ряд {row}: нить {yarn}, а в палитре {paletteSize}',
    },
    saveChanges: {
      title: 'Сохранить изменения в файл?',
      description: 'В схеме есть изменения, которых нет в сохранённом файле .kchart.',
      discard: 'Отбросить',
      cancel: 'Отмена',
      save: 'Сохранить в файл',
    },
  },
  autosave: {
    title: 'Автосохранение в браузере',
    saved: 'сохранено',
    saving: 'сохраняется…',
    failed: 'автосохранение не работает',
    failedHint: 'Сохраните схему в файл',
    failedToast: 'Автосохранение не работает: сохраните схему в файл',
    restoreFailed: 'Не удалось восстановить схему',
    downloadRaw: 'Скачать как есть',
    otherTab: 'Редактор открыт в другой вкладке',
    otherTabHint:
      'Схема сохраняется только в одной вкладке. Здесь работа продолжится с её правками.',
    workHere: 'Работать здесь',
  },
  layout: {
    menuBar: 'Меню',
    tools: 'Инструменты',
    sidePanel: 'Панель',
    statusBar: 'Статус',
  },
  tool: {
    brush: 'Кисть',
    eraser: 'Ластик',
    eyedropper: 'Пипетка',
  },
  yarn: {
    byNumber: 'Нить по номеру',
    swap: 'Поменять местами текущую и предыдущую нить',
    pair: 'Текущая нить {current}, предыдущая — {previous}',
  },
  palette: {
    list: 'Нити палитры',
    select: 'Нить {number}: {name}',
    unnamed: 'без имени',
    stitches: '0 петель | {n} петля | {n} петли | {n} петель',
    edit: 'Изменить нить {number}',
    add: 'Добавить нить',
    rejected: {
      'palette-full': 'Палитра полна: больше нитей добавить нельзя',
    },
  },
  yarnEditor: {
    title: 'Нить {number}',
    hex: 'Цвет (hex)',
    hexInvalid: 'Нужен цвет вида #rrggbb',
    name: 'Имя или артикул',
    remove: 'Удалить',
    blocked: {
      'last-yarn': 'Последнюю нить удалить нельзя',
      'yarn-in-use': 'Нить есть в схеме: удалить можно только неиспользуемую',
    },
  },
  menu: {
    file: {
      title: 'Файл',
      open: 'Открыть .kchart…',
      save: 'Сохранить в файл .kchart',
    },
    edit: {
      title: 'Правка',
      undo: 'Отменить',
      redo: 'Повторить',
    },
    view: {
      title: 'Вид',
      fit: 'Вписать',
      zoomIn: 'Приблизить',
      zoomOut: 'Отдалить',
      lineHighlight: 'Подсветка ряда и столбца',
    },
    help: {
      title: 'Справка',
      shortcuts: 'Горячие клавиши',
    },
  },
  help: {
    shortcuts: {
      title: 'Горячие клавиши',
      description: 'Клавиши работают в любой раскладке.',
      keys: 'Клавиши',
      command: 'Команда',
    },
  },
  panel: {
    palette: 'Палитра',
  },
  status: {
    cell: 'ряд {row}, петля {stitch}',
    size: 'Размер: {width} × {height}',
    zoom: 'Масштаб: {percent}%',
    tool: 'Инструмент: {tool}',
    yarn: 'Нить: {number}',
    unsavedToFile: 'не в файле',
  },
}

export type Messages = typeof ru
