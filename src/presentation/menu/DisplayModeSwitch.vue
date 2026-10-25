<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UFieldGroup from '@nuxt/ui/components/FieldGroup.vue'
import { DISPLAY_MODES, nextDisplayMode, type DisplayMode } from '../../application/editorSession'
import { useCommands } from '../commands/useCommands'
import { useEditor } from '../editor/useEditor'

const { t } = useI18n()
const { state, dispatch } = useEditor()

const select = (mode: DisplayMode) => dispatch({ type: 'select-display-mode', mode })

// The session ignores a mode change during a gesture by itself.
useCommands([
  {
    id: 'view.nextDisplayMode',
    label: 'displayMode.next',
    keys: [{ code: 'Tab' }],
    run: () => select(nextDisplayMode(state.value.displayMode)),
  },
])
</script>

<template>
  <UFieldGroup size="xs" :aria-label="t('displayMode.title')" role="group">
    <UButton
      v-for="mode in DISPLAY_MODES"
      :key="mode"
      :label="t(`displayMode.${mode}`)"
      :aria-pressed="state.displayMode === mode"
      :color="state.displayMode === mode ? 'primary' : 'neutral'"
      :variant="state.displayMode === mode ? 'soft' : 'outline'"
      @click="select(mode)"
    />
  </UFieldGroup>
</template>
