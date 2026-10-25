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
  menu: {
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
  },
}

export type Messages = typeof ru
