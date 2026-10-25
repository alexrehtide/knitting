// ПРОТОТИП. Пункты меню «Файл» — общие для вариантов.
import { state, guardedReplaceChart, log } from './state.js'

export const fileItems = () => [
  [
    { label: 'Новая схема…', icon: 'i-lucide-file-plus', kbds: ['ctrl', 'n'], onSelect: () => guardedReplaceChart('new') },
    { label: 'Открыть .kchart…', icon: 'i-lucide-folder-open', kbds: ['ctrl', 'o'], onSelect: () => guardedReplaceChart('import') },
    { label: 'Сохранить в файл .kchart', icon: 'i-lucide-save', kbds: ['ctrl', 's'], onSelect: () => { state.dirty = false; log('экспорт .kchart (заглушка)') } },
  ],
  [
    { label: 'Экспорт PNG', icon: 'i-lucide-image', onSelect: () => log('экспорт PNG (заглушка)') },
    { label: 'Экспорт PDF…', icon: 'i-lucide-printer', kbds: ['ctrl', 'p'], onSelect: () => (state.dialog = 'pdf') },
  ],
]
export const editItems = () => [
  [
    { label: 'Отменить', icon: 'i-lucide-undo-2', kbds: ['ctrl', 'z'], onSelect: () => log('undo (заглушка)') },
    { label: 'Повторить', icon: 'i-lucide-redo-2', kbds: ['ctrl', 'shift', 'z'], onSelect: () => log('redo (заглушка)') },
  ],
  [
    { label: 'Размер схемы…', icon: 'i-lucide-scaling', onSelect: () => (state.dialog = 'resize') },
    { label: 'Свойства схемы…', icon: 'i-lucide-settings-2', onSelect: () => (state.dialog = 'props') },
  ],
]
export const viewItems = () => [
  [
    { label: 'Вписать в окно', icon: 'i-lucide-maximize', kbds: ['ctrl', '0'], onSelect: () => dispatchEvent(new Event('kchart:fit')) },
    { label: 'Приблизить', icon: 'i-lucide-zoom-in', kbds: ['ctrl', '='], onSelect: () => (state.zoom = Math.min(64, state.zoom * 1.25)) },
    { label: 'Отдалить', icon: 'i-lucide-zoom-out', kbds: ['ctrl', '-'], onSelect: () => (state.zoom = Math.max(2, state.zoom / 1.25)) },
  ],
  [
    { label: 'Подсветка ряда и столбца', type: 'checkbox', checked: state.crosshair, onUpdateChecked: v => (state.crosshair = v) },
  ],
]
export const helpItems = () => [[{ label: 'Горячие клавиши', icon: 'i-lucide-keyboard', kbds: ['?'], onSelect: () => (state.dialog = 'keys') }]]
