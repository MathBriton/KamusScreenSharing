import { expect, test } from '@playwright/test';
import { chatInput, joinRoom, messages, newPerson, pasteImage, sendChat, uniqueRoom } from './helpers';

test('histórico para quem chega depois, prints colados e abas de imagens e links', async ({ browser }) => {
  const room = uniqueRoom('chat');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');

  await sendChat(ana, 'Material: https://pt.wikipedia.org/wiki/WebRTC (ver seção 2).');
  // Link clicável, sem a pontuação final grudada.
  await expect(messages(ana).getByRole('link', { name: 'https://pt.wikipedia.org/wiki/WebRTC' })).toHaveAttribute(
    'target',
    '_blank',
  );

  await pasteImage(ana, 'PRINT DA ANA');
  await expect(ana.getByRole('list', { name: 'Imagens a enviar' }).getByRole('img')).toHaveCount(1);
  await chatInput(ana).fill('olha esse print');
  await ana.getByRole('button', { name: 'Enviar' }).click();
  await expect(messages(ana).getByRole('img', { name: 'Imagem de Ana' })).toBeVisible();

  // Bruno chega depois e vê tudo.
  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');
  await expect(messages(bruno)).toContainText('olha esse print');
  await expect(messages(bruno).getByRole('img', { name: 'Imagem de Ana' })).toBeVisible();

  // Tempo real, sem duplicar (resposta da API + repasse pelo LiveKit).
  await sendChat(bruno, 'cheguei! https://livekit.io/docs');
  await expect(messages(ana).getByText('cheguei!')).toHaveCount(1);

  await bruno.getByRole('tab', { name: /Imagens/ }).click();
  await expect(bruno.getByRole('tab', { name: 'Imagens (1)' })).toHaveAttribute('data-state', 'active');
  await bruno.getByRole('tabpanel').getByRole('button').first().click();
  await expect(bruno.getByRole('dialog').getByRole('img')).toBeVisible();
  await bruno.keyboard.press('Escape');

  await bruno.getByRole('tab', { name: /Links/ }).click();
  const links = bruno.getByRole('tabpanel').getByRole('link');
  await expect(links).toHaveCount(2);
  await expect(links.first()).toHaveAttribute('href', 'https://livekit.io/docs');
});

test('servidor recusa formatos que não são imagem', async ({ browser }) => {
  const room = uniqueRoom('upload');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');
  const status = await ana.evaluate(async (r) => {
    const session = JSON.parse(localStorage.getItem('kamus:session')!);
    const { token } = await (
      await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ room: r }),
      })
    ).json();
    const res = await fetch(`/api/rooms/${r}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/svg+xml' },
      body: '<svg onload="alert(1)"/>',
    });
    return res.status;
  }, room);
  expect(status).toBe(415);
});
