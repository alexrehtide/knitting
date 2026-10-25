<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ru as uiRu } from '@nuxt/ui/locale'
import UApp from '@nuxt/ui/components/App.vue'
import UTabs from '@nuxt/ui/components/Tabs.vue'
import AutosaveStatus from './autosave/AutosaveStatus.vue'
import OtherTabScreen from './autosave/OtherTabScreen.vue'
import ChartCanvas from './canvas/ChartCanvas.vue'
import { useChartView } from './canvas/useChartView'
import { provideCommands } from './commands/useCommands'
import { useEditor } from './editor/useEditor'
import { useViewPreferences } from './editor/useViewPreferences'
import DisplayModeSwitch from './menu/DisplayModeSwitch.vue'
import EditMenu from './menu/EditMenu.vue'
import FileMenu from './menu/FileMenu.vue'
import HelpMenu from './menu/HelpMenu.vue'
import ViewMenu from './menu/ViewMenu.vue'
import PalettePanel from './palette/PalettePanel.vue'
import YarnSwatch from './palette/YarnSwatch.vue'
import ToolButtons from './tools/ToolButtons.vue'
import YarnPair from './tools/YarnPair.vue'

const { t } = useI18n()
const { state, dispatch } = useEditor()
const view = useChartView(state)
useViewPreferences(view, state, dispatch)
provideCommands()

const currentYarn = computed(() => {
  const { palette } = state.value.chart
  const index = palette.findIndex((y) => y.id === state.value.currentYarn)
  return { number: index + 1, color: palette[index]?.color ?? 'transparent' }
})

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
          <FileMenu />
          <EditMenu />
          <ViewMenu :view="view" />
          <HelpMenu />
        </nav>
        <h1 class="truncate text-sm font-medium">
          {{ state.chart.properties.title.trim() || t('chart.untitled') }}
          <span v-if="state.unsavedToFile" :title="t('chart.unsavedToFile')">•</span>
        </h1>
        <div class="flex justify-end">
          <DisplayModeSwitch />
        </div>
      </header>

      <div class="flex min-h-0 flex-1">
        <aside
          :aria-label="t('layout.tools')"
          class="flex w-12 shrink-0 flex-col items-center gap-2 border-r border-default py-2"
        >
          <ToolButtons />
          <div class="mt-auto">
            <YarnPair />
          </div>
        </aside>

        <main class="relative min-w-0 flex-1 overflow-hidden bg-muted">
          <ChartCanvas :view="view" />
        </main>

        <aside
          :aria-label="t('layout.sidePanel')"
          class="flex w-80 shrink-0 flex-col border-l border-default"
        >
          <UTabs
            :items="panelTabs"
            default-value="palette"
            variant="link"
            class="min-h-0 w-full flex-1"
            :ui="{ content: 'flex min-h-0 flex-1 flex-col' }"
          >
            <template #palette>
              <PalettePanel />
            </template>
          </UTabs>
        </aside>
      </div>

      <footer
        :aria-label="t('layout.statusBar')"
        class="flex h-7 shrink-0 items-center gap-4 border-t border-default px-3 text-xs text-muted"
      >
        <!-- Fixed width, so the rest of the bar does not jump as the pointer moves; empty off the grid. -->
        <span class="w-36 tabular-nums">{{
          view.hoverNumber.value
            ? t('status.cell', {
                row: view.hoverNumber.value.row,
                stitch: view.hoverNumber.value.stitch,
              })
            : ''
        }}</span>
        <span>{{
          t('status.size', { width: state.chart.width, height: state.chart.height })
        }}</span>
        <span>{{ t('status.zoom', { percent: view.zoomPercent.value }) }}</span>
        <span>{{ t('status.tool', { tool: t(`tool.${state.activeTool}`) }) }}</span>
        <span v-if="state.preview" class="tabular-nums">{{
          state.preview.size.kind === 'line'
            ? t('status.lineLength', { length: state.preview.size.length })
            : t('status.rectangleSize', state.preview.size)
        }}</span>
        <span class="flex items-center gap-1.5">
          {{ t('status.yarn', { number: currentYarn.number }) }}
          <YarnSwatch :color="currentYarn.color" class="size-3" />
        </span>
        <AutosaveStatus />
        <span v-if="state.unsavedToFile">{{ t('status.unsavedToFile') }}</span>
      </footer>
    </div>
    <OtherTabScreen />
  </UApp>
</template>
