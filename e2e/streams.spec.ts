import { expect, test } from '@playwright/test';
import { blur, expectVideoPlaying, joinRoom, newPerson, startSharing, uniqueRoom } from './helpers';

test('várias transmissões: grade, foco, trocar de tela, zoom e tela cheia', async ({ browser }) => {
  const room = uniqueRoom('multi');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');
  await startSharing(ana);
  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');
  await startSharing(bruno);

  const carla = await newPerson(browser);
  await joinRoom(carla, room, 'Carla');

  // Grade: todas ao mesmo tempo, cada card com LIVE e "Transmitindo".
  await expectVideoPlaying(carla, 'Ana');
  await expectVideoPlaying(carla, 'Bruno');
  const anaTile = carla.getByTestId('tile-Ana');
  await expect(anaTile.getByText('LIVE')).toBeVisible();
  await expect(anaTile.getByText('Transmitindo')).toBeVisible();

  // Clique seleciona (borda de destaque).
  await carla.getByTestId('tile-Bruno').click({ position: { x: 200, y: 150 } });
  await expect(carla.getByTestId('tile-Bruno')).toHaveAttribute('data-selected', 'true');

  // Foco pelo menu do card; as outras ficam em miniatura.
  await anaTile.getByRole('button', { name: 'Opções da transmissão de Ana' }).click();
  await carla.getByRole('menuitem', { name: 'Ver em foco' }).click();
  await expect(carla.getByRole('button', { name: 'Foco' })).toHaveAttribute('aria-pressed', 'true');
  await expect(carla.getByTestId('tile-Ana')).toBeVisible();
  await expect(carla.getByTestId('tile-Bruno')).toHaveCount(0);

  await carla.getByRole('button', { name: 'Ver transmissão de Bruno' }).click();
  await expectVideoPlaying(carla, 'Bruno');
  await carla.getByRole('button', { name: 'Alternar tela' }).click();
  await expect(carla.getByTestId('tile-Ana')).toBeVisible();

  // Teclado: G alterna grade/foco.
  await blur(carla);
  await carla.keyboard.press('g');
  await expect(carla.getByRole('button', { name: 'Grade' })).toHaveAttribute('aria-pressed', 'true');

  // Zoom: botões e roda do mouse.
  const tile = carla.getByTestId('tile-Ana');
  await tile.hover();
  const zoomLabel = tile.getByRole('button', { name: /Zoom atual/ });
  await tile.getByRole('button', { name: 'Aumentar zoom' }).click();
  await expect(zoomLabel).toHaveText('125%');
  const box = (await tile.boundingBox())!;
  await carla.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
  await carla.mouse.wheel(0, -400);
  await expect.poll(async () => parseInt(await zoomLabel.innerText())).toBeGreaterThan(125);
  await zoomLabel.click();
  await expect(zoomLabel).toHaveText('100%');

  // Tela cheia das transmissões.
  await carla.getByRole('button', { name: 'Tela cheia' }).click();
  await expect.poll(() => carla.evaluate(() => document.fullscreenElement?.getAttribute('aria-label'))).toBe('Transmissões');
  await carla.keyboard.press('f');
  await expect.poll(() => carla.evaluate(() => document.fullscreenElement)).toBeNull();
});
