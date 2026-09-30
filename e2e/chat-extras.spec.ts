import { expect, test, type Page } from '@playwright/test';
import { chatInput, joinRoom, messages, newPerson, pasteImage, sendChat, uniqueRoom } from './helpers';

const messageItem = (page: Page, text: string) => messages(page).getByTestId('message').filter({ hasText: text });

test('menções: autocompletar, destaque e aviso para quem foi mencionado', async ({ browser }) => {
  const room = uniqueRoom('mencao');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');
  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');
  await expect(ana.getByRole('list', { name: 'Participantes' })).toContainText('Bruno');

  await chatInput(ana).pressSequentially('oi @Bru');
  await expect(ana.getByRole('option', { name: 'Bruno' })).toBeVisible();
  await chatInput(ana).press('Enter');
  // Continua digitando sem pausa: as letras não podem sair de ordem.
  await chatInput(ana).pressSequentially('olha isso');
  await expect(chatInput(ana)).toHaveValue('oi @Bruno olha isso');
  await chatInput(ana).press('Enter');

  await expect(bruno.locator('[data-sonner-toast]', { hasText: 'Ana mencionou você' })).toBeVisible();
  const item = messageItem(bruno, 'olha isso');
  await expect(item).toHaveAttribute('data-mention', 'true');
  await expect(item.getByText('@Bruno', { exact: true })).toBeVisible();
  // Para quem escreveu não é "menção a mim".
  await expect(messageItem(ana, 'olha isso')).not.toHaveAttribute('data-mention', 'true');
});

test('responder citando e fixar mensagens (inclusive para quem chega depois)', async ({ browser }) => {
  const room = uniqueRoom('fixar');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');
  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');

  await sendChat(ana, 'guia do chefe: https://example.com/guia');
  // .first(): a resposta também contém o texto citado.
  const original = messageItem(bruno, 'guia do chefe').first();
  await original.hover();
  await original.getByRole('button', { name: 'Responder Ana' }).click();
  await expect(bruno.getByLabel('Respondendo')).toContainText('guia do chefe');
  await chatInput(bruno).fill('valeu!');
  await chatInput(bruno).press('Enter');

  const reply = messageItem(ana, 'valeu!');
  await expect(reply.getByRole('button', { name: 'Ver mensagem de Ana' })).toContainText('guia do chefe');

  await original.hover();
  await original.getByRole('button', { name: 'Fixar mensagem' }).click();
  const pinnedBar = ana.getByRole('region', { name: 'Mensagens fixadas' });
  await expect(pinnedBar).toContainText('Fixadas (1)');

  const carla = await newPerson(browser);
  await joinRoom(carla, room, 'Carla');
  await expect(carla.getByRole('region', { name: 'Mensagens fixadas' })).toContainText('guia do chefe');

  await pinnedBar.getByRole('button', { name: /Fixadas/ }).click();
  await pinnedBar.getByRole('button', { name: 'Desafixar mensagem' }).click();
  await expect(carla.getByRole('region', { name: 'Mensagens fixadas' })).toHaveCount(0);
});

test('busca no histórico com filtro de links e salto até a mensagem', async ({ browser }) => {
  const room = uniqueRoom('busca');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');
  await sendChat(ana, 'estratégia do chefe final');
  await sendChat(ana, 'mapa do chefe https://example.com/mapa');
  await sendChat(ana, 'outra conversa');

  await ana.getByRole('button', { name: 'Buscar no histórico' }).click();
  await ana.getByRole('textbox', { name: 'Buscar no histórico' }).fill('chefe');
  const results = ana.getByRole('list', { name: 'Resultados da busca' });
  await expect(results.getByRole('listitem')).toHaveCount(2);

  await ana.getByRole('button', { name: 'Links', exact: true }).click();
  await expect(results.getByRole('listitem')).toHaveCount(1);
  await expect(results).toContainText('mapa do chefe');

  await results.getByRole('button').first().click();
  await expect(messages(ana)).toBeVisible();
  await expect(messageItem(ana, 'mapa do chefe')).toBeInViewport();
});

test('"fulano está digitando…"', async ({ browser }) => {
  const room = uniqueRoom('digitando');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');
  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');

  await chatInput(ana).pressSequentially('escrevendo algo');
  await expect(bruno.getByText('Ana está digitando…')).toBeVisible();
  await chatInput(ana).press('Enter');
  await expect(bruno.getByText('Ana está digitando…')).toHaveCount(0);
});

test('rabiscar no print antes de enviar', async ({ browser }) => {
  const room = uniqueRoom('rabisco');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');

  await pasteImage(ana, 'PRINT');
  await ana.getByRole('button', { name: 'Rabiscar em print.png' }).click();
  const dialog = ana.getByRole('dialog', { name: 'Rabiscar no print' });
  await dialog.getByRole('button', { name: 'Retângulo' }).click();
  const canvas = dialog.getByLabel('Área de desenho');
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBe(480);
  const box = (await canvas.boundingBox())!;
  await ana.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  await ana.mouse.down();
  await ana.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 5 });
  await ana.mouse.up();
  await dialog.getByRole('button', { name: 'Usar imagem' }).click();

  await expect(ana.getByRole('list', { name: 'Imagens a enviar' }).getByRole('img', { name: 'print-anotado.png' })).toBeVisible();
  await ana.getByRole('button', { name: 'Enviar' }).click();
  const sent = messages(ana).getByRole('img', { name: 'Imagem de Ana' });
  await expect(sent).toBeVisible();

  // A borda do retângulo (vermelha) está na imagem enviada, sobre o fundo azul.
  const pixel = await sent.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const [r, , b] = g.getImageData(Math.round(img.naturalWidth * 0.1), Math.round(img.naturalHeight * 0.35), 1, 1).data;
    return { r, b };
  });
  expect(pixel.r).toBeGreaterThan(200);
  expect(pixel.b).toBeLessThan(120);
});
