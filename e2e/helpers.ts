import { expect, type Browser, type Page } from '@playwright/test';

export const uniqueRoom = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Cada pessoa em um contexto separado (como navegadores diferentes). */
export async function newPerson(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}): Promise<Page> {
  const context = await browser.newContext(options);
  return context.newPage();
}

/** Abre o link da sala, informa o nome e espera conectar. */
export async function joinRoom(page: Page, room: string, name: string, presenter = false) {
  await page.goto(`/s/${room}${presenter ? '?apresentar' : ''}`);
  await page.getByLabel('Seu nome').fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
}

export async function startSharing(page: Page) {
  const presentButton = page.getByRole('button', { name: 'Apresentar', exact: true });
  if (await presentButton.isVisible()) await presentButton.click();
  await page.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expect(page.getByRole('button', { name: 'Parar compartilhamento' })).toBeVisible();
}

/** Espera o vídeo de alguém estar tocando de verdade (com quadros). */
export async function expectVideoPlaying(page: Page, tileName: string) {
  await expect
    .poll(() => page.getByTestId(`tile-${tileName}`).locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
}

export const chatInput = (page: Page) => page.getByRole('textbox', { name: 'Mensagem' });
export const messages = (page: Page) => page.getByRole('list', { name: 'Mensagens' });

export async function sendChat(page: Page, text: string) {
  await chatInput(page).fill(text);
  await chatInput(page).press('Enter');
  await expect(messages(page).getByText(text.split(' ')[0], { exact: false }).last()).toBeVisible();
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
