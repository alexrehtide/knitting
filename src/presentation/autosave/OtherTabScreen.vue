<script setup lang="ts">
import { nextTick, onScopeDispose, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import { autosaveKey, injectStrict } from '../editor/injection'

const { t } = useI18n()
const autosave = injectStrict(autosaveKey)
const owner = shallowRef(autosave.owner)
const taking = shallowRef(false)
const button = useTemplateRef<{ $el: HTMLElement }>('button')

onScopeDispose(
  autosave.subscribe((event) => {
    if (event.type === 'owner') owner.value = autosave.owner
  }),
)

/**
 * The editor's keys stay silent under the screen; the screen's own keys, such as Tab and Enter on its
 * button, still do what they do by default.
 */
function silence(event: KeyboardEvent) {
  event.stopImmediatePropagation()
}

function silenceKeys(on: boolean) {
  for (const type of ['keydown', 'keyup'] as const) {
    if (on) window.addEventListener(type, silence, true)
    else window.removeEventListener(type, silence, true)
  }
}

watch(
  owner,
  async (owns) => {
    silenceKeys(!owns)
    if (owns) return
    await nextTick()
    button.value?.$el.focus()
  },
  { immediate: true },
)
onScopeDispose(() => silenceKeys(false))

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
  <div
    v-if="!owner"
    role="dialog"
    aria-modal="true"
    aria-labelledby="other-tab-title"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-default/95 p-4 backdrop-blur-sm"
  >
    <div class="flex max-w-sm flex-col items-center gap-3 text-center">
      <h2 id="other-tab-title" class="text-lg font-semibold">{{ t('autosave.otherTab') }}</h2>
      <p class="text-sm text-muted">{{ t('autosave.otherTabHint') }}</p>
      <UButton ref="button" :label="t('autosave.workHere')" :loading="taking" @click="workHere" />
    </div>
  </div>
</template>
