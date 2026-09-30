import { expect, test } from '@playwright/test';
import { expectVideoPlaying, joinRoom, newPerson, startSharing, uniqueRoom } from './helpers';

const captureSettings = (page: import('@playwright/test').Page) =>
  page
    .getByTestId('tile-Ana')
    .locator('video')
    .evaluate((v: HTMLVideoElement) => {
      const track = (v.srcObject as MediaStream).getVideoTracks()[0];
      const s = track.getSettings();
      return { height: s.height, fps: s.frameRate, hint: track.contentHint };
    });

test('apresentar, assistir e trocar a qualidade ao vivo', async ({ browser }) => {
  const room = uniqueRoom('share');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana', true);

  await ana.getByRole('button', { name: 'Qualidade da transmissão' }).click();
  await ana.getByText('Jogo / vídeo').click();
  await ana.keyboard.press('Escape');
  await startSharing(ana);
  expect(await captureSettings(ana)).toMatchObject({ height: 720, fps: 60, hint: 'motion' });

  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');
  await expectVideoPlaying(bruno, 'Ana');
  await expect(bruno.getByRole('list', { name: 'Participantes' }).getByRole('listitem').filter({ hasText: 'Ana' }).getByText('ao vivo')).toBeVisible();

  // Troca sem reabrir o seletor de tela.
  await ana.getByRole('button', { name: 'Qualidade da transmissão' }).click();
  await ana.getByText('Texto / código').click();
  await expect(ana.getByText('Qualidade: Texto / código')).toBeVisible();
  await expect.poll(() => captureSettings(ana)).toMatchObject({ fps: 15, hint: 'detail' });
  await expect(ana.getByRole('button', { name: 'Parar compartilhamento' })).toBeVisible();

  await ana.keyboard.press('Escape');
  await ana.getByRole('button', { name: 'Parar compartilhamento' }).click();
  await expect(bruno.getByText('Aguardando alguém compartilhar a tela…')).toBeVisible();
});

test('espectador assume a apresentação sem reconectar', async ({ browser }) => {
  const room = uniqueRoom('papel');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');
  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');

  await startSharing(bruno);
  await expect(bruno).toHaveURL(/\?apresentar$/);
  await expectVideoPlaying(ana, 'Bruno');

  // Trocar de papel não gera "saiu/entrou".
  await expect(ana.getByRole('list', { name: 'Mensagens' })).not.toContainText('Bruno saiu');
});
