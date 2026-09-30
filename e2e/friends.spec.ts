import { expect, test } from '@playwright/test';
import { joinRoom, newPerson, startSharing, uniqueRoom } from './helpers';

test('menu Amigos: quem está online, ao vivo, e entrar na sala', async ({ browser }) => {
  const roomA = uniqueRoom('amigos-a');
  const roomB = uniqueRoom('amigos-b');
  const ana = await newPerson(browser);
  await joinRoom(ana, roomA, 'Ana Amiga');
  await startSharing(ana);

  const bruno = await newPerson(browser);
  await joinRoom(bruno, roomB, 'Bruno Amigo');

  await bruno.getByRole('button', { name: /^Amigos/ }).click();
  const online = bruno.getByRole('list', { name: 'Amigos online' });
  const anaItem = online.getByRole('listitem').filter({ hasText: 'Ana Amiga' });
  await expect(anaItem).toContainText(`sala ${roomA}`);
  await expect(anaItem.getByText('ao vivo')).toBeVisible();
  await expect(online.getByRole('listitem').filter({ hasText: 'Bruno Amigo' })).toContainText('nesta sala');

  await anaItem.getByRole('button', { name: 'Entrar' }).click();
  await expect(bruno).toHaveURL(new RegExp(`/s/${roomA}$`));
  await expect(bruno.getByRole('heading', { name: `Sala ${roomA}` })).toBeVisible();
  await expect(bruno.getByRole('status')).toHaveCount(0);
});

test('menu Amigos: vistos recentemente', async ({ browser }) => {
  const room = uniqueRoom('visto');
  const carla = await newPerson(browser);
  await joinRoom(carla, room, 'Carla Sumida');
  await carla.getByRole('button', { name: 'Sair da sala' }).click();
  await carla.context().close();

  const ana = await newPerson(browser);
  await ana.goto('/');
  await ana.getByRole('button', { name: /^Amigos/ }).click();
  await expect(ana.getByRole('list', { name: 'Vistos recentemente' })).toContainText('Carla Sumida');
});
