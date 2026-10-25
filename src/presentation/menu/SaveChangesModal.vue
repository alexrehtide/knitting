<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

/** What to do with the changes not in a file before the chart is replaced. */
export type SaveChangesChoice = 'save' | 'discard' | 'cancel'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ choose: [choice: SaveChangesChoice] }>()

const { t } = useI18n()

function choose(choice: SaveChangesChoice) {
  open.value = false
  emit('choose', choice)
}
</script>

<template>
  <!-- Not dismissible: only a button decides what happens to the changes. -->
  <UModal
    v-model:open="open"
    :title="t('file.saveChanges.title')"
    :description="t('file.saveChanges.description')"
    :dismissible="false"
    :close="false"
    :ui="{ footer: 'justify-between' }"
  >
    <template #footer>
      <UButton
        :label="t('file.saveChanges.discard')"
        color="error"
        variant="ghost"
        @click="choose('discard')"
      />
      <div class="flex gap-2">
        <UButton
          :label="t('file.saveChanges.cancel')"
          color="neutral"
          variant="outline"
          @click="choose('cancel')"
        />
        <UButton :label="t('file.saveChanges.save')" @click="choose('save')" />
      </div>
    </template>
  </UModal>
</template>
