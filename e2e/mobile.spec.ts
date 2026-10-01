import { devices, expect, test } from '@playwright/test';
import { login, uniqueRoom } from './helpers';

// Emula um iPhone (viewport, toque e user agent) no Chromium.
const { defaultBrowserType: _ignored, ...iPhone } = devices['iPhone 13'];
test.use(iPhone);

test('no celular não há opção de transmitir, só assistir', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Celular só assiste')).toBeVisible();
  await login(page, 'Dani');
  await expect(page.getByRole('button', { name: 'Criar sala' })).toBeVisible();

  const room = uniqueRoom('mobile');
  await page.goto(`/s/${room}`);
  await expect(page.getByRole('heading', { name: `Sala ${room}` })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Transmitir', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Compartilhar tela' })).toHaveCount(0);
  // Controles essenciais continuam acessíveis na tela estreita.
  await expect(page.getByRole('button', { name: 'Sair da sala' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Grade' })).toBeInViewport();
});
