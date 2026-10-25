import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['html', { open: 'never' }], ['github']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/knitting/`,
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
    url: `http://localhost:${PORT}/knitting/`,
    reuseExistingServer: !isCI,
  },
})
