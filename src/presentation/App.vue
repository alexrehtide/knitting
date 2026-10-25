<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ru as uiRu } from '@nuxt/ui/locale'
import UApp from '@nuxt/ui/components/App.vue'
import UTabs from '@nuxt/ui/components/Tabs.vue'
import ChartCanvas from './canvas/ChartCanvas.vue'
import { useChartView } from './canvas/useChartView'
import { useEditor } from './editor/useEditor'
import ViewMenu from './menu/ViewMenu.vue'

const { t } = useI18n()
const { state } = useEditor()
const view = useChartView(state)

const panelTabs = [{ label: t('panel.palette'), value: 'palette', slot: 'palette' as const }]
</script>

<template>
  <UApp :locale="uiRu">
    <div class="flex h-full flex-col bg-default text-default">
      <header
        :aria-label="t('layout.menuBar')"
        class="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-default px-2"
      >
        <nav class="flex items-center gap-1">
          <ViewMenu :view="view" />
        </nav>
        <h1 class="truncate text-sm font-medium">{{ t('chart.untitled') }}</h1>
        <div />
      </header>

      <div class="flex min-h-0 flex-1">
        <aside
          :aria-label="t('layout.tools')"
          class="flex w-12 shrink-0 flex-col items-center gap-2 border-r border-default py-2"
        />

        <main class="relative min-w-0 flex-1 overflow-hidden bg-muted">
          <ChartCanvas :view="view" />
        </main>

        <aside
          :aria-label="t('layout.sidePanel')"
          class="flex w-80 shrink-0 flex-col border-l border-default"
        >
          <UTabs :items="panelTabs" default-value="palette" variant="link" class="w-full">
            <template #palette />
          </UTabs>
        </aside>
      </div>

      <footer
        :aria-label="t('layout.statusBar')"
        class="flex h-7 shrink-0 items-center gap-4 border-t border-default px-3 text-xs text-muted"
      >
        <span>{{
          t('status.size', { width: state.chart.width, height: state.chart.height })
        }}</span>
        <span>{{ t('status.zoom', { percent: view.zoomPercent.value }) }}</span>
      </footer>
    </div>
  </UApp>
</template>
