import { defineConfig } from '@playwright/test';

const APP_PORT = 3100;
// Permite usar um Chromium já instalado (ex.: ambientes sem `playwright install`).
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
    // Chromium "completo" em modo headless: suporta a captura de tela falsa.
    ...(executablePath ? {} : { channel: 'chromium' }),
    launchOptions: {
      executablePath,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--auto-select-desktop-capture-source=Entire screen',
      ],
    },
  },
  webServer: [
    {
      command: 'sh scripts/livekit-dev.sh',
      url: 'http://127.0.0.1:7880',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'rm -rf e2e/.data && npm run build && node --disable-warning=ExperimentalWarning server/dist/index.js',
      url: `http://127.0.0.1:${APP_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        PORT: String(APP_PORT),
        HOST: '127.0.0.1',
        DATA_DIR: 'e2e/.data',
        LIVEKIT_URL: 'ws://127.0.0.1:7880',
        LIVEKIT_API_KEY: 'devkey',
        LIVEKIT_API_SECRET: 'secret',
      },
    },
  ],
});
