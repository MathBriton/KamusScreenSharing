import { expect, type Browser, type Page } from '@playwright/test';

export const uniqueRoom = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Cada pessoa em um contexto separado (como navegadores diferentes). */
export async function newPerson(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}): Promise<Page> {
  const context = await browser.newContext(options);
  return context.newPage();
}

export const TEST_PIN = '1234';

/**
 * Entra com nome + PIN pela tela inicial (já aberta). Cria o perfil na primeira vez; nas
 * seguintes, entra com o mesmo PIN (os testes reaproveitam nomes entre arquivos).
 */
export async function login(page: Page, name: string, pin = TEST_PIN) {
  const form = page.getByRole('region', { name: 'Entrar' });
  for (let attempt = 0; attempt < 3; attempt++) {
    await form.getByLabel('Seu nome').fill(name);
    await form.getByRole('button', { name: 'Continuar' }).click();
    const create = form.getByRole('button', { name: 'Criar perfil' });
    const enter = form.getByRole('button', { name: 'Entrar', exact: true });
    await expect(create.or(enter)).toBeVisible();
    if (await create.isVisible()) {
      await form.getByLabel('Escolha um PIN').fill(pin);
      await form.getByLabel('Repita o PIN').fill(pin);
      await create.click();
    } else {
      await form.getByLabel('PIN', { exact: true }).fill(pin);
      await enter.click();
    }
    // Outro teste em paralelo pode ter criado o mesmo nome ao mesmo tempo: tenta de novo.
    const profile = page.getByRole('button', { name: `Perfil de ${name}` });
    const error = form.getByRole('alert');
    await expect(profile.or(error)).toBeVisible();
    if (await profile.isVisible()) return;
    await form.getByRole('button', { name: /trocar nome/ }).click();
  }
  throw new Error(`não consegui entrar como ${name}`);
}

/** Abre o link da sala, entra com nome + PIN e espera conectar (chat liberado). */
export async function joinRoom(page: Page, room: string, name: string, pin = TEST_PIN) {
  await page.goto(`/s/${room}`);
  await login(page, name, pin);
  await expect(page.getByRole('heading', { name: `Sala ${room}` })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toBeEnabled();
}

export async function startSharing(page: Page) {
  await page.getByRole('button', { name: 'Transmitir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Parar transmissão' })).toBeVisible();
}

/** Espera o vídeo de alguém estar tocando de verdade (com quadros). */
export async function expectVideoPlaying(page: Page, tileName: string) {
  await expect
    .poll(() => page.getByTestId(`tile-${tileName}`).locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
}

export const chatInput = (page: Page) => page.getByRole('textbox', { name: 'Mensagem', exact: true });
export const messages = (page: Page) => page.getByRole('list', { name: 'Mensagens' });

export async function sendChat(page: Page, text: string) {
  await chatInput(page).fill(text);
  await chatInput(page).press('Enter');
  await expect(messages(page).getByText(text.split(' ')[0], { exact: false }).last()).toBeVisible();
}

/** Tira o foco do chat para os atalhos de teclado funcionarem. */
export async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Simula colar (Ctrl+V) uma imagem gerada num canvas. */
export async function pasteImage(page: Page, label: string) {
  await chatInput(page).evaluate(async (el, text) => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#3366ff';
    g.fillRect(0, 0, 480, 270);
    g.fillStyle = '#fff';
    g.font = '36px sans-serif';
    g.fillText(text, 40, 150);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const data = new DataTransfer();
    data.items.add(new File([blob], 'print.png', { type: 'image/png' }));
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, label);
}
