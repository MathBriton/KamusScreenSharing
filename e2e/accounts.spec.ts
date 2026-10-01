import { expect, test } from '@playwright/test';
import { joinRoom, login, newPerson, sendChat, startSharing, uniqueRoom } from './helpers';

test('nome + PIN: PIN errado é recusado e o perfil vale em outro navegador', async ({ browser }) => {
  const name = `Gabi ${uniqueRoom('p').slice(2)}`;
  const first = await newPerson(browser);
  await first.goto('/');
  await login(first, name, '4321');

  const other = await newPerson(browser);
  await other.goto('/');
  const form = other.getByRole('region', { name: 'Entrar' });
  await form.getByLabel('Seu nome').fill(name.toUpperCase());
  await form.getByRole('button', { name: 'Continuar' }).click();
  await form.getByLabel('PIN', { exact: true }).fill('0000');
  await form.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('PIN incorreto');

  await form.getByLabel('PIN', { exact: true }).fill('4321');
  await form.getByRole('button', { name: 'Entrar', exact: true }).click();
  // Entra com o nome como foi cadastrado.
  await expect(other.getByRole('button', { name: `Perfil de ${name}` })).toBeVisible();

  // A sessão sobrevive ao recarregar.
  await other.reload();
  await expect(other.getByRole('button', { name: `Perfil de ${name}` })).toBeVisible();
});

test('perfil: trocar nome e PIN, sair da conta', async ({ page }) => {
  const suffix = uniqueRoom('n').slice(2);
  await page.goto('/');
  await login(page, `Hugo ${suffix}`);

  await page.getByRole('button', { name: `Perfil de Hugo ${suffix}` }).click();
  await page.getByRole('menuitem', { name: 'Trocar nome' }).click();
  await page.getByLabel('Nome', { exact: true }).fill(`Hugão ${suffix}`);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('button', { name: `Perfil de Hugão ${suffix}` })).toBeVisible();

  await page.getByRole('button', { name: `Perfil de Hugão ${suffix}` }).click();
  await page.getByRole('menuitem', { name: 'Trocar PIN' }).click();
  await page.getByLabel('PIN atual').fill('1234');
  await page.getByLabel('Novo PIN').fill('9876');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: `Perfil de Hugão ${suffix}` }).click();
  await page.getByRole('menuitem', { name: 'Sair da conta' }).click();
  await login(page, `Hugão ${suffix}`, '9876');
});

test('sininho: menção em outra sala e amigo ao vivo', async ({ browser }) => {
  const roomA = uniqueRoom('sino-a');
  const roomB = uniqueRoom('sino-b');
  const ivo = await newPerson(browser);
  await joinRoom(ivo, roomA, 'Ivo Sino');

  const julia = await newPerson(browser);
  await joinRoom(julia, roomB, 'Julia Sino');

  await sendChat(julia, 'chama o @Ivo Sino aqui');
  await expect(ivo.locator('[data-sonner-toast]', { hasText: `Julia Sino mencionou você na sala ${roomB}` })).toBeVisible();

  await startSharing(julia);
  await expect(ivo.locator('[data-sonner-toast]', { hasText: 'Julia Sino está ao vivo' })).toBeVisible();

  await ivo.getByRole('button', { name: /^Notificações \(2 não lidas\)/ }).click();
  const list = ivo.getByRole('list', { name: 'Notificações' });
  await expect(list).toContainText(`Julia Sino mencionou você · sala ${roomB}`);
  await list.getByRole('button', { name: /Julia Sino está ao vivo/ }).click();
  await expect(ivo.getByRole('heading', { name: `Sala ${roomB}` })).toBeVisible();
});
