/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

// GitHub Pages serves the site from /knitting/; dev runs at the root.
export const PAGES_BASE = '/knitting/'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [
    vue(),
    ui({
      router: false,
      autoImport: false,
      components: false,
      theme: { colors: ['primary', 'neutral', 'warning', 'error'] },
      ui: { colors: { primary: 'indigo', neutral: 'zinc' } },
      icon: { clientBundle: { scan: true } },
      experimental: { componentDetection: true },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
}))
