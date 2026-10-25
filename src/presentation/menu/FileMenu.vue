<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu, { type DropdownMenuItem } from '@nuxt/ui/components/DropdownMenu.vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import type { KchartError } from '../../application/chartFile'
import { useCommandMenuItems, useCommands } from '../commands/useCommands'
import { downloadJson } from '../editor/download'
import { chartFileFormatKey, injectStrict } from '../editor/injection'
import { useEditor } from '../editor/useEditor'
import NewChartModal from './NewChartModal.vue'
import SaveChangesModal, { type SaveChangesChoice } from './SaveChangesModal.vue'

const { t } = useI18n()
const { state, dispatch } = useEditor()
const format = injectStrict(chartFileFormatKey)
const toast = useToast()
const fileInput = useTemplateRef('fileInput')
const saveChangesOpen = ref(false)

/** Starts the `.kchart` download; the browser does not report the write, so the chart counts as saved. */
function save() {
  const file = format.write(state.value.chart)
  downloadJson(file.name, file.text)
  dispatch({ type: 'mark-saved' })
}

/** What goes on to replace the chart once the changes not in a file are saved or discarded. */
let afterSaveChanges = () => {}

/** Asks what to do with the changes not in a file first, if there are any, then goes on with `then`. */
function askSaveChanges(then: () => void) {
  if (!state.value.unsavedToFile) return then()
  afterSaveChanges = then
  saveChangesOpen.value = true
}

function onSaveChanges(choice: SaveChangesChoice) {
  if (choice === 'cancel') return
  if (choice === 'save') save()
  afterSaveChanges()
}

const newChartOpen = ref(false)
const newChart = () => askSaveChanges(() => (newChartOpen.value = true))
const open = () => askSaveChanges(() => fileInput.value?.click())

function errorMessage(error: KchartError) {
  if (error.code !== 'corrupt') return t(`file.error.${error.code}`)
  const { kind, ...params } = error.detail
  return t('file.error.corrupt', { detail: t(`file.corruption.${kind}`, params) })
}

/** A broken file leaves the chart as it is and says why in a toast. */
async function onFileChosen() {
  const input = fileInput.value
  const file = input?.files?.[0]
  if (!input || !file) return
  // The same file can be chosen again.
  input.value = ''
  const result = format.read(await file.text())
  if (result.ok) dispatch({ type: 'replace-chart', chart: result.chart })
  else toast.add({ title: errorMessage(result.error), color: 'error' })
}

// Off during a gesture: the file would hold a stroke that is not finished.
// `Alt+N` is the spare one: Chrome keeps `Ctrl+N` for a new window.
useCommands([
  {
    id: 'file.new',
    label: 'menu.file.new',
    keys: [
      { code: 'KeyN', ctrl: true },
      { code: 'KeyN', alt: true },
    ],
    run: newChart,
    enabled: () => !state.value.gestureActive,
  },
  {
    id: 'file.open',
    label: 'menu.file.open',
    keys: [{ code: 'KeyO', ctrl: true }],
    run: open,
    enabled: () => !state.value.gestureActive,
  },
  {
    id: 'file.save',
    label: 'menu.file.save',
    keys: [{ code: 'KeyS', ctrl: true }],
    run: save,
    enabled: () => !state.value.gestureActive,
  },
])

const commandItems = useCommandMenuItems(['file.new', 'file.open', 'file.save'])
const items = computed<DropdownMenuItem[][]>(() => [commandItems.value])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'start' }">
    <UButton :label="t('menu.file.title')" color="neutral" variant="ghost" size="sm" />
  </UDropdownMenu>
  <input
    ref="fileInput"
    type="file"
    accept=".kchart"
    class="hidden"
    tabindex="-1"
    @change="onFileChosen"
  />
  <SaveChangesModal v-model:open="saveChangesOpen" @choose="onSaveChanges" />
  <NewChartModal v-model:open="newChartOpen" />
</template>
