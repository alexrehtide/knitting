import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'
import App from './presentation/App.vue'
import { i18n } from './presentation/i18n'
import './presentation/main.css'

createApp(App).use(i18n).use(ui).mount('#app')
