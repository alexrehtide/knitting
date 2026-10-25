<script setup lang="ts">
import { computed, onScopeDispose, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { autosaveKey, injectStrict } from '../editor/injection'

const { t } = useI18n()
const autosave = injectStrict(autosaveKey)
const owner = shallowRef(autosave.owner)
const taking = shallowRef(false)
// The editor's keys stay silent while a dialog is open (commands/registry.ts, `keyboardTaken`).
const open = computed(() => !owner.value)

onScopeDispose(
  autosave.subscribe((event) => {
    if (event.type === 'owner') owner.value = autosave.owner
  }),
)

async function workHere() {
  taking.value = true
  try {
    await autosave.takeOver()
  } finally {
    taking.value = false
  }
}
</script>

<template>
  <!-- Not dismissible: the tab works again only by taking the lock. -->
  <UModal
    :open="open"
    :title="t('autosave.otherTab')"
    :description="t('autosave.otherTabHint')"
    :dismissible="false"
    :close="false"
    :ui="{ overlay: 'bg-default/95 backdrop-blur-sm', footer: 'justify-end' }"
  >
    <template #footer>
      <UButton :label="t('autosave.workHere')" :loading="taking" @click="workHere" />
    </template>
  </UModal>
</template>
