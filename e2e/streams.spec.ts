import { expect, test } from '@playwright/test';
import { expectVideoPlaying, joinRoom, newPerson, startSharing, uniqueRoom } from './helpers';

test('duas transmissões ao mesmo tempo: escolher, lado a lado e zoom', async ({ browser }) => {
  const room = uniqueRoom('multi');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');
  await startSharing(ana);
  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');
  await startSharing(bruno);

  const carla = await newPerson(browser);
  await joinRoom(carla, room, 'Carla');
  const picker = carla.getByRole('tablist', { name: 'Escolher transmissão' });
  await expect(picker.getByRole('tab')).toHaveCount(2);

  // Modo foco: uma grande, a outra em miniatura; clicar troca.
  await picker.getByRole('tab', { name: 'Bruno' }).click();
  await expectVideoPlaying(carla, 'Bruno');
  await expect(carla.getByRole('button', { name: 'Ver transmissão de Ana' })).toBeVisible();
  await carla.getByRole('button', { name: 'Ver transmissão de Ana' }).click();
  await expectVideoPlaying(carla, 'Ana');

  // Lado a lado.
  await carla.getByRole('button', { name: 'Ver lado a lado' }).click();
  await expectVideoPlaying(carla, 'Ana');
  await expectVideoPlaying(carla, 'Bruno');

  // Zoom: botões e roda do mouse.
  const tile = carla.getByTestId('tile-Ana');
  await tile.hover();
  await tile.getByRole('button', { name: 'Aumentar zoom' }).click();
  await expect(tile.getByRole('button', { name: /Zoom atual/ })).toHaveText('125%');
  const box = (await tile.boundingBox())!;
  await carla.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
  await carla.mouse.wheel(0, -400);
  await expect.poll(async () => parseInt(await tile.getByRole('button', { name: /Zoom atual/ }).innerText())).toBeGreaterThan(125);
  await tile.getByRole('button', { name: /Zoom atual/ }).click();
  await expect(tile.getByRole('button', { name: /Zoom atual/ })).toHaveText('100%');

  // Tela cheia do palco.
  await carla.keyboard.press('f');
  await expect.poll(() => carla.evaluate(() => document.fullscreenElement?.getAttribute('aria-label'))).toBe('Transmissões');
  await carla.keyboard.press('f');
  await expect.poll(() => carla.evaluate(() => document.fullscreenElement)).toBeNull();
});
