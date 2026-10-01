import { expect, test } from '@playwright/test';
import { joinRoom, login, newPerson, startSharing, uniqueRoom } from './helpers';

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
  // A própria pessoa não aparece na lista.
  const lists = bruno.getByRole('list', { name: /^Amigos (online|offline)$/ });
  await expect(lists.getByRole('listitem').filter({ hasText: 'Bruno Amigo' })).toHaveCount(0);

  await anaItem.getByRole('button', { name: 'Entrar na sala de Ana Amiga' }).click();
  await expect(bruno).toHaveURL(new RegExp(`/s/${roomA}$`));
  await expect(bruno.getByRole('heading', { name: `Sala ${roomA}` })).toBeVisible();
});

test('menu Amigos: offline com "visto há…"', async ({ browser }) => {
  const room = uniqueRoom('visto');
  const carla = await newPerson(browser);
  await joinRoom(carla, room, 'Carla Sumida');
  await carla.getByRole('button', { name: 'Sair da sala' }).click();
  await carla.context().close();

  const ana = await newPerson(browser);
  await ana.goto('/');
  await login(ana, 'Ana Vê');
  await ana.getByRole('button', { name: /^Amigos/ }).click();
  const carlaItem = ana.getByRole('list', { name: 'Amigos offline' }).getByRole('listitem').filter({ hasText: 'Carla Sumida' });
  await expect(carlaItem).toContainText(`sala ${room}`);
  await expect(carlaItem).toContainText('visto');
});

test('mensagens privadas: entrega em tempo real, não lidas e sininho', async ({ browser }) => {
  const dani = await newPerson(browser);
  await dani.goto('/');
  await login(dani, 'Dani Privada');

  const edu = await newPerson(browser);
  await edu.goto('/');
  await login(edu, 'Edu Privado');

  // Edu abre a conversa pelo menu Amigos (Dani está offline: fora de sala).
  await edu.getByRole('button', { name: /^Amigos/ }).click();
  await edu.getByRole('button', { name: 'Mensagem para Dani Privada' }).click();
  const eduPanel = edu.getByRole('dialog');
  await expect(eduPanel).toContainText('Dani Privada');
  await eduPanel.getByRole('textbox', { name: 'Mensagem privada' }).fill('oi Dani, só entre nós');
  await eduPanel.getByRole('button', { name: 'Enviar mensagem privada' }).click();
  await expect(eduPanel.getByTestId('dm')).toContainText('oi Dani, só entre nós');

  // Dani recebe aviso, sininho com não lida e badge no menu Amigos.
  await expect(dani.locator('[data-sonner-toast]', { hasText: 'Mensagem de Edu Privado' })).toBeVisible();
  await dani.getByRole('button', { name: 'Notificações (1 não lidas)' }).click();
  await dani.getByRole('list', { name: 'Notificações' }).getByRole('button', { name: /Mensagem de Edu Privado/ }).click();
  const daniPanel = dani.getByRole('dialog');
  await expect(daniPanel.getByTestId('dm')).toContainText('oi Dani, só entre nós');

  // Resposta chega para o Edu com o painel aberto, sem toast.
  await daniPanel.getByRole('textbox', { name: 'Mensagem privada' }).fill('recebi!');
  await daniPanel.getByRole('textbox', { name: 'Mensagem privada' }).press('Enter');
  await expect(eduPanel.getByTestId('dm').last()).toContainText('recebi!');

  // Ao fechar o painel, o sininho já não tem não lidas.
  await dani.keyboard.press('Escape');
  await expect(dani.getByRole('button', { name: 'Notificações', exact: true })).toBeVisible();
});
