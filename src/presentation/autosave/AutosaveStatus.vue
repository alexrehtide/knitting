<script setup lang="ts">
import { onMounted, onScopeDispose, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@nuxt/ui/composables/useToast'
import { downloadJson } from '../editor/download'
import { autosaveKey, injectStrict } from '../editor/injection'

const { t } = useI18n()
const toast = useToast()
const autosave = injectStrict(autosaveKey)
const status = shallowRef(autosave.status)

onScopeDispose(
  autosave.subscribe((event) => {
    status.value = autosave.status
    if (event.type === 'failed') toast.add({ title: t('autosave.failedToast'), color: 'error' })
    if (event.type === 'owner' && autosave.owner) showBrokenRecord()
  }),
)

// The record failed to restore before the editor opened, or on «Работать здесь»; the toast stays until
// the user downloads or closes it.
onMounted(showBrokenRecord)

function showBrokenRecord() {
  const broken = autosave.brokenRecord
  if (!broken) return
  toast.add({
    title: t('autosave.restoreFailed'),
    color: 'error',
    duration: Infinity,
    actions: [
      {
        label: t('autosave.downloadRaw'),
        color: 'neutral',
        variant: 'outline',
        onClick: () =>
          downloadJson('autosave-broken.json', JSON.stringify(broken.record, null, 2) ?? ''),
      },
    ],
  })
}
</script>

<template>
  <span
    v-if="status === 'failed'"
    class="font-medium text-error"
    :title="t('autosave.failedHint')"
    >{{ t('autosave.failed') }}</span
  >
  <span v-else :title="t('autosave.title')">{{ t(`autosave.${status}`) }}</span>
</template>
