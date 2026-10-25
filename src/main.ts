import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'
import { createAutosave } from './application/autosave'
import { createEditorSession } from './application/editorSession'
import { createChart } from './domain/chart'
import { isValidChartDimension } from './domain/chartSize'
import { createCanvasRenderer } from './infrastructure/canvasRenderer'
import { createIndexedDbAutosave } from './infrastructure/indexedDbAutosave'
import { createWebLockAutosave } from './infrastructure/webLockAutosave'
import { kchartFormat } from './infrastructure/kchart'
import { systemClock } from './infrastructure/systemClock'
import { systemDelay } from './infrastructure/systemDelay'
import App from './presentation/App.vue'
import {
  autosaveKey,
  chartFileFormatKey,
  chartRendererKey,
  editorSessionKey,
} from './presentation/editor/injection'
import { i18n } from './presentation/i18n'
import './presentation/main.css'

const session = createEditorSession({ clock: systemClock })
const autosave = createAutosave({
  session,
  storage: createIndexedDbAutosave(),
  lock: createWebLockAutosave(),
  format: kchartFormat,
  delay: systemDelay,
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autosave.flush()
})
window.addEventListener('beforeunload', (event) => {
  if (autosave.unloadLoses) event.preventDefault()
})

// The editor opens on the restored chart, so the view fits it from the start; without the lock it opens
// under the screen «Редактор открыт в другой вкладке».
void autosave.start().then(() => {
  // Dev only: `?chart=500` opens a 500×500 chart with random cells to check zoom and scroll by hand.
  const devChartSize = import.meta.env.DEV
    ? Number(new URLSearchParams(location.search).get('chart'))
    : 0
  if (autosave.owner && isValidChartDimension(devChartSize)) {
    // The chart is not in the session yet, so filling its grid directly bypasses no edit;
    // it replaces the restored chart, and the autosave keeps it.
    const chart = createChart(devChartSize, devChartSize, systemClock.now())
    for (let i = 0; i < chart.cells.length; i++) chart.cells[i] = Math.floor(Math.random() * 3)
    session.dispatch({ type: 'replace-chart', chart })
  }

  createApp(App)
    .provide(editorSessionKey, session)
    .provide(chartRendererKey, (canvases) => createCanvasRenderer(canvases, session))
    .provide(chartFileFormatKey, kchartFormat)
    .provide(autosaveKey, autosave)
    .use(i18n)
    .use(ui)
    .mount('#app')
})
