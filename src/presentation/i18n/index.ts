import { createI18n } from 'vue-i18n'
import { ru, type Messages } from './ru'

export const i18n = createI18n<[Messages], 'ru', false>({
  legacy: false,
  locale: 'ru',
  messages: { ru },
  // Russian plural forms: «0 петель | 1 петля | 2 петли | 5 петель».
  pluralRules: {
    ru: (choice, choicesLength) => {
      if (choice === 0) return 0
      const teen = choice % 100 > 10 && choice % 100 < 20
      if (!teen && choice % 10 === 1) return 1
      if (!teen && choice % 10 >= 2 && choice % 10 <= 4) return 2
      return choicesLength < 4 ? 2 : 3
    },
  },
})
