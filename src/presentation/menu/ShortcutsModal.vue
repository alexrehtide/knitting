<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UKbd from '@nuxt/ui/components/Kbd.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { shownKbds } from '../commands/registry'
import { useCommandRegistry } from '../commands/useCommands'

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const registry = useCommandRegistry()

const rows = computed(() =>
  registry
    .list()
    .map((command) => ({ id: command.id, label: t(command.label), keys: shownKbds(command) }))
    .filter((row) => row.keys.length > 0),
)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('help.shortcuts.title')"
    :description="t('help.shortcuts.description')"
  >
    <template #body>
      <table class="w-full text-sm">
        <thead class="sr-only">
          <tr>
            <th>{{ t('help.shortcuts.keys') }}</th>
            <th>{{ t('help.shortcuts.command') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" class="border-b border-default last:border-0">
            <td class="py-1.5 pr-4 whitespace-nowrap">
              <template v-for="(combo, i) in row.keys" :key="i">
                <span v-if="i > 0" class="px-1 text-muted">,</span>
                <span class="inline-flex gap-0.5">
                  <UKbd v-for="key in combo" :key="key" :value="key" />
                </span>
              </template>
            </td>
            <td class="py-1.5">{{ row.label }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </UModal>
</template>
