import type { ChatMessage } from '@/api';

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;

export type TextPart = { type: 'text'; value: string } | { type: 'link'; url: string };

/** Remove pontuação final que costuma grudar no link ("veja https://x.com/a."). */
function trimUrl(url: string): string {
  let out = url;
  while (/[.,;:!?'"\]}>]$/.test(out) || (out.endsWith(')') && count(out, '(') < count(out, ')'))) {
    out = out.slice(0, -1);
  }
  return out;
}

const count = (s: string, ch: string) => s.split(ch).length - 1;

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const url = trimUrl(match[0]);
    const start = match.index;
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) });
    parts.push({ type: 'link', url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

/** Links diretos para imagens/GIFs viram prévia no chat e entram na aba Imagens. */
export function isImageUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return /\.(gif|png|jpe?g|webp)$/i.test(pathname) || /^media\d*\.(giphy|tenor)\.com$/i.test(hostname);
  } catch {
    return false;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export interface GalleryImage {
  key: string;
  url: string;
  author: string;
  createdAt: number;
  external: boolean;
}

export interface SharedLink {
  key: string;
  url: string;
  author: string;
  createdAt: number;
}

/** Imagens (anexos + links de imagem) e links externos, dos mais novos para os mais antigos. */
export function collectMedia(messages: ChatMessage[]): { images: GalleryImage[]; links: SharedLink[] } {
  const images: GalleryImage[] = [];
  const links: SharedLink[] = [];
  for (const m of messages) {
    m.attachments.forEach((a) =>
      images.push({ key: a.id, url: a.url, author: m.author, createdAt: m.createdAt, external: false }),
    );
    splitLinks(m.text).forEach((part, i) => {
      if (part.type !== 'link') return;
      const item = { key: `${m.id}:${i}`, url: part.url, author: m.author, createdAt: m.createdAt };
      if (isImageUrl(part.url)) images.push({ ...item, external: true });
      else links.push(item);
    });
  }
  const newestFirst = (a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt;
  return { images: images.sort(newestFirst), links: links.sort(newestFirst) };
}

export function formatTime(ms: number): string {
  const date = new Date(ms);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`;
}
