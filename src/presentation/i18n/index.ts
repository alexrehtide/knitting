import { createI18n } from 'vue-i18n'
import { ru, type Messages } from './ru'

export const i18n = createI18n<[Messages], 'ru', false>({
  legacy: false,
  locale: 'ru',
  messages: { ru },
})
