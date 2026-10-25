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
  },
}

export type Messages = typeof ru
