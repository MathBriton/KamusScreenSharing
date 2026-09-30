import { devices, expect, test } from '@playwright/test';
import { joinRoom, uniqueRoom } from './helpers';

// Emula um iPhone (viewport, toque e user agent) no Chromium.
const { defaultBrowserType: _ignored, ...iPhone } = devices['iPhone 13'];
test.use(iPhone);

test('no celular não há opção de transmitir, só assistir', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Celular só assiste')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar sala', exact: true })).toBeVisible();

  const room = uniqueRoom('mobile');
  // Mesmo com link de apresentador, entra assistindo.
  await joinRoom(page, room, 'Dani', true);
  await expect(page).toHaveURL(new RegExp(`/s/${room}$`));
  await expect(page.getByText('Só assistir')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apresentar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Compartilhar tela' })).toHaveCount(0);
});
