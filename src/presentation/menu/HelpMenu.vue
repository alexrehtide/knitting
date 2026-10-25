<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import { useCommandMenuItems, useCommands } from '../commands/useCommands'
import ShortcutsModal from './ShortcutsModal.vue'

const { t } = useI18n()
const shortcutsOpen = ref(false)

useCommands([
  {
    id: 'help.shortcuts',
    label: 'menu.help.shortcuts',
    keys: [{ key: '?' }],
    run: () => (shortcutsOpen.value = true),
  },
])

const items = useCommandMenuItems(['help.shortcuts'])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'start' }">
    <UButton :label="t('menu.help.title')" color="neutral" variant="ghost" size="sm" />
  </UDropdownMenu>
  <ShortcutsModal v-model:open="shortcutsOpen" />
</template>
