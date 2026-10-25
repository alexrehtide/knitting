export const ru = {
  chart: {
    canvasLabel: 'Схема',
    untitled: 'Без названия',
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
  },
}

export type Messages = typeof ru
