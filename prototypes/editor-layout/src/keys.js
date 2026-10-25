// ПРОТОТИП. Мини-реестр команд по event.code; справка строится из него же.
import { state, selectYarn, guardedReplaceChart, log, MODES } from './state.js'

const tool = id => () => (state.tool = id)
export const KEYS = [
  { label: 'Кисть', kbds: [['B']], codes: ['KeyB'], run: tool('brush') },
  { label: 'Ластик', kbds: [['E']], codes: ['KeyE'], run: tool('eraser') },
  { label: 'Заливка', kbds: [['G']], codes: ['KeyG'], run: tool('fill') },
  { label: 'Пипетка', kbds: [['I'], ['alt']], codes: ['KeyI'], run: tool('pipette') },
  { label: 'Линия', kbds: [['L']], codes: ['KeyL'], run: tool('line') },
  { label: 'Прямоугольник', kbds: [['R']], codes: ['KeyR'], run: tool('rect') },
  { label: 'Нить по номеру', kbds: [['1'], ['9']], codes: [] },
  { label: 'Две последние нити', kbds: [['X']], codes: ['KeyX'], run: () => selectYarn(state.previous) },
  { label: 'Режим отображения', kbds: [['tab']], codes: ['Tab'], run: () => {
    const i = MODES.findIndex(m => m.id === state.displayMode); state.displayMode = MODES[(i + 1) % MODES.length].id } },
  { label: 'Отменить', kbds: [['ctrl', 'Z']], codes: ['ctrl+KeyZ'], run: () => log('undo (заглушка)') },
  { label: 'Повторить', kbds: [['ctrl', 'shift', 'Z'], ['ctrl', 'Y']], codes: ['ctrl+shift+KeyZ', 'ctrl+KeyY'], run: () => log('redo (заглушка)') },
  { label: 'Сохранить .kchart', kbds: [['ctrl', 'S']], codes: ['ctrl+KeyS'], run: () => { state.dirty = false; log('экспорт .kchart (заглушка)') } },
  { label: 'Открыть .kchart', kbds: [['ctrl', 'O']], codes: ['ctrl+KeyO'], run: () => guardedReplaceChart('import') },
  { label: 'Экспорт PDF', kbds: [['ctrl', 'P']], codes: ['ctrl+KeyP'], run: () => (state.dialog = 'pdf') },
  { label: 'Новая схема', kbds: [['ctrl', 'N'], ['alt', 'N']], codes: ['ctrl+KeyN', 'alt+KeyN'], run: () => guardedReplaceChart('new') },
  { label: 'Вписать в окно', kbds: [['ctrl', '0']], codes: ['ctrl+Digit0'], run: () => dispatchEvent(new Event('kchart:fit')) },
  { label: 'Приблизить / отдалить', kbds: [['ctrl', '='], ['ctrl', '-']], codes: [] },
  { label: 'Справка по клавишам', kbds: [['?']], codes: ['shift+Slash'], run: () => (state.dialog = 'keys') },
]

export function onKeydown(e) {
  const t = e.target
  if (t.closest?.('input, textarea, [contenteditable], [role="dialog"]') || state.dialog || state.popoverOpen) return
  if (e.code.startsWith('Digit') && !e.ctrlKey && !e.altKey) {
    const n = +e.code.slice(5)
    const y = state.palette[n - 1]
    if (n >= 1 && y) { selectYarn(y.id); e.preventDefault() }
    return
  }
  if (e.ctrlKey && (e.code === 'Equal' || e.code === 'Minus')) {
    state.zoom = e.code === 'Equal' ? Math.min(64, state.zoom * 1.25) : Math.max(2, state.zoom / 1.25)
    e.preventDefault(); return
  }
  const combo = (e.ctrlKey || e.metaKey ? 'ctrl+' : '') + (e.shiftKey && e.code !== 'Tab' ? 'shift+' : '') + (e.altKey ? 'alt+' : '') + e.code
  const k = KEYS.find(k => k.codes.includes(combo))
  if (k) { e.preventDefault(); k.run() }
}
