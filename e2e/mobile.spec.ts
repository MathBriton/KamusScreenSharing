import { devices, expect, test } from '@playwright/test';
import { joinRoom, uniqueRoom } from './helpers';

// Emula um iPhone (viewport, toque e user agent) no Chromium.
const { defaultBrowserType: _ignored, ...iPhone } = devices['iPhone 13'];
test.use(iPhone);

test('no celular não há opção de transmitir, só assistir', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Celular só assiste')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar sala' })).toBeVisible();

  const room = uniqueRoom('mobile');
  await joinRoom(page, room, 'Dani');
  await expect(page.getByRole('button', { name: 'Transmitir', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Compartilhar tela' })).toHaveCount(0);
  // Controles essenciais continuam acessíveis na tela estreita.
  await expect(page.getByRole('button', { name: 'Sair da sala' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Grade' })).toBeInViewport();
});
