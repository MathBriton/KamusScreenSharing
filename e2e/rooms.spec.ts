import { expect, test } from '@playwright/test';
import { joinRoom, login, newPerson, uniqueRoom } from './helpers';

test('sala fixa: nome amigável vira link permanente e fica nas recentes', async ({ page }) => {
  const suffix = uniqueRoom('x').slice(2);
  await page.goto('/');
  await login(page, 'Ana');
  await page.getByLabel('Nome da sala (opcional)').fill(`Amigos da Firma ${suffix}!`);
  await expect(page.getByText(`/s/amigos-da-firma-${suffix}`)).toBeVisible();
  await page.getByRole('button', { name: 'Criar sala' }).click();

  await expect(page).toHaveURL(new RegExp(`/s/amigos-da-firma-${suffix}$`));
  await expect(page.getByRole('heading', { name: `Sala amigos-da-firma-${suffix}` })).toBeVisible();

  await page.getByRole('button', { name: 'Sair da sala' }).click();
  await expect(page.getByRole('button', { name: `amigos-da-firma-${suffix}`, exact: true })).toBeVisible();
});

test('links antigos (?sala=, ?apresentar) são convertidos para /s/<sala>', async ({ page }) => {
  const room = uniqueRoom('legado');
  await page.goto(`/?sala=${room}&papel=apresentador`);
  await expect(page).toHaveURL(new RegExp(`/s/${room}$`));
  await expect(page.getByRole('heading', { name: `Entrar na sala ${room}` })).toBeVisible();
  // Depois de entrar com nome + PIN, vai direto para a sala do link.
  await login(page, 'Ana');
  await expect(page.getByRole('heading', { name: `Sala ${room}` })).toBeVisible();
});

test('menu Salas: salas ativas e criar/entrar', async ({ browser }) => {
  const room = uniqueRoom('ativa');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana Salas');

  const bruno = await newPerson(browser);
  await bruno.goto('/');
  await login(bruno, 'Bruno Salas');
  await bruno.getByRole('button', { name: 'Salas', exact: true }).click();
  const active = bruno.getByRole('list', { name: 'Salas ativas' }).getByRole('listitem').filter({ hasText: room });
  await expect(active).toContainText('Ana Salas');
  await active.getByRole('button', { name: 'Entrar' }).click();
  await expect(bruno.getByRole('heading', { name: `Sala ${room}` })).toBeVisible();

  const other = uniqueRoom('nova');
  await bruno.getByRole('button', { name: 'Salas', exact: true }).click();
  await bruno.getByLabel('Sala para entrar ou criar').fill(other);
  await bruno.getByLabel('Sala para entrar ou criar').press('Enter');
  await expect(bruno.getByRole('heading', { name: `Sala ${other}` })).toBeVisible();
});

test('avisos de entrada e saída', async ({ browser }) => {
  const room = uniqueRoom('avisos');
  const ana = await newPerson(browser);
  await joinRoom(ana, room, 'Ana');
  const bruno = await newPerson(browser);
  await joinRoom(bruno, room, 'Bruno');

  await expect(ana.locator('[data-sonner-toast]', { hasText: 'Bruno entrou na sala' })).toBeVisible();
  await expect(ana.getByRole('list', { name: 'Mensagens' })).toContainText('Bruno entrou na sala');

  await bruno.getByRole('button', { name: 'Sair da sala' }).click();
  await expect(ana.locator('[data-sonner-toast]', { hasText: 'Bruno saiu da sala' })).toBeVisible();
});
