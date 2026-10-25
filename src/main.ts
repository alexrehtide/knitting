import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'
import { createEditorSession } from './application/editorSession'
import { createChart } from './domain/chart'
import { isValidChartDimension } from './domain/chartSize'
import { createCanvasRenderer } from './infrastructure/canvasRenderer'
import { systemClock } from './infrastructure/systemClock'
import App from './presentation/App.vue'
import { chartRendererKey, editorSessionKey } from './presentation/editor/injection'
import { i18n } from './presentation/i18n'
import './presentation/main.css'

const session = createEditorSession({ clock: systemClock })

// Dev only: `?chart=500` opens a 500×500 chart with random cells to check zoom and scroll by hand.
const devChartSize = import.meta.env.DEV
  ? Number(new URLSearchParams(location.search).get('chart'))
  : 0
if (isValidChartDimension(devChartSize)) {
  // The chart is not in the session yet, so filling its grid directly bypasses no edit.
  const chart = createChart(devChartSize, devChartSize, systemClock.now())
  for (let i = 0; i < chart.cells.length; i++) chart.cells[i] = Math.floor(Math.random() * 3)
  session.dispatch({ type: 'replace-chart', chart })
}

createApp(App)
  .provide(editorSessionKey, session)
  .provide(chartRendererKey, (canvases) => createCanvasRenderer(canvases, session))
  .use(i18n)
  .use(ui)
  .mount('#app')
