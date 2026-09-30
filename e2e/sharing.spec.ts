import { expect, test, type Page } from '@playwright/test';
import { expectVideoPlaying, joinRoom, newPerson, startSharing, uniqueRoom } from './helpers';

const captureSettings = (page: Page, name: string) =>
  page
    .getByTestId(`tile-${name}`)
    .locator('video')
    .evaluate((v: HTMLVideoElement) => {
      const track = (v.srcObject as MediaStream).getVideoTracks()[0];
      const s = track.getSettings();
      return { height: s.height, fps: s.frameRate, hint: track.contentHint, id: track.id };
    });

async function pickQuality(page: Page, label: string) {
  await page.getByRole('button', { name: 'Configurações' }).click();
  await page.getByText(label, { exact: true }).click();
  await page.keyboard.press('Escape');
}

test('transmitir, assistir, trocar a qualidade ao vivo e parar', async ({ browser }) => {
  const room = uniqueRoom('share');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');

  await pickQuality(ana, 'Jogo / vídeo');
  await startSharing(ana);
  expect(await captureSettings(ana, 'Ana')).toMatchObject({ height: 720, fps: 60, hint: 'motion' });

  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');
  await expectVideoPlaying(bruno, 'Ana');

  // Sidebar: quem transmite, com resolução e FPS; barra superior: LIVE e métricas.
  const anaRow = bruno.getByRole('list', { name: 'Participantes' }).getByRole('listitem').filter({ hasText: 'Ana' });
  await expect(anaRow).toContainText('Transmitindo');
  await expect(anaRow).toContainText('60 FPS');
  await expect(bruno.getByLabel('Sala ao vivo')).toBeVisible();
  await expect(bruno.getByTestId('metrics')).toContainText(/\d+ ms/);
  await expect(bruno.getByTestId('metrics')).toContainText(/\d+p/);

  // Qualidade trocada sem reabrir o seletor de tela.
  await pickQuality(ana, 'Texto / código');
  await expect(ana.getByText('Qualidade: Texto / código')).toBeVisible();
  await expect.poll(() => captureSettings(ana, 'Ana')).toMatchObject({ fps: 15, hint: 'detail' });
  await expect(anaRow).toContainText('15 FPS');

  await ana.getByRole('button', { name: 'Parar transmissão' }).click();
  await expect(bruno.getByText('Ninguém transmitindo')).toBeVisible();
  await expect(anaRow).toContainText('Não transmitindo');
});

test('compartilhar outra tela sem derrubar a transmissão', async ({ browser }) => {
  const room = uniqueRoom('trocar');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');
  await startSharing(ana);
  const before = await captureSettings(ana, 'Ana');

  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');
  await expectVideoPlaying(bruno, 'Ana');

  await ana.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expect(ana.getByText('Tela trocada')).toBeVisible();
  await expect.poll(async () => (await captureSettings(ana, 'Ana')).id).not.toBe(before.id);
  await expect(ana.getByRole('button', { name: 'Parar transmissão' })).toBeVisible();

  // Para quem assiste, nada foi interrompido.
  await expectVideoPlaying(bruno, 'Ana');
  await expect(bruno.getByRole('list', { name: 'Mensagens' })).not.toContainText('Ana parou de transmitir');
});
