import { defineConfig, devices } from '@playwright/test'
import { PAGES_BASE } from './vite.config'

const isCI = !!process.env.CI
const PORT = 4173
const APP_URL = `http://localhost:${PORT}${PAGES_BASE}`

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['html', { open: 'never' }], ['github']] : [['list']],
  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
  ],
  // e2e runs against the production build, with the same base path as GitHub Pages.
  webServer: {
    command: `pnpm exec vite preview --port ${PORT} --strictPort`,
    url: APP_URL,
    reuseExistingServer: !isCI,
  },
})
