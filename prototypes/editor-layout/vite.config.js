// ПРОТОТИП, выбросить. Тикет «Раскладка интерфейса редактора» (#7).
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

export default defineConfig({
  plugins: [
    vue(),
    ui({
      router: false,
      theme: { colors: ['primary', 'neutral', 'error', 'warning'] },
      ui: { colors: { primary: 'indigo', neutral: 'zinc' } },
      icon: { clientBundle: { scan: true } },
    }),
  ],
})
