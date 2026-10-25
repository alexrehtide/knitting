<script setup>
// ПРОТОТИП, выбросить. Тикет «Раскладка интерфейса редактора» (#7).
// Три варианта раскладки на одной странице, переключение ?variant=A|B|C и ←/→.
// Диалоги, холст и меню общие — различается только раскладка.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ru } from '@nuxt/ui/locale'
import { state } from './state.js'
import { onKeydown } from './keys.js'
import VariantA from './VariantA.vue'
import VariantB from './VariantB.vue'
import VariantC from './VariantC.vue'
import Dialogs from './Dialogs.vue'
import Switcher from './Switcher.vue'

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC }
const variant = ref(new URLSearchParams(location.search).get('variant') ?? 'A')
onMounted(() => addEventListener('keydown', onKeydown))
onBeforeUnmount(() => removeEventListener('keydown', onKeydown))
</script>

<template>
  <UApp :locale="ru">
    <component :is="VARIANTS[variant]" :key="variant" />
    <Dialogs />
    <Switcher v-model="variant" :variants="VARIANTS" />
  </UApp>
</template>
