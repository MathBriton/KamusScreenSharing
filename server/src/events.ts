import type { Response } from 'express';

/**
 * Eventos em tempo real para cada perfil (Server-Sent Events). Funciona mesmo fora de
 * qualquer sala: é por aqui que chegam mensagens privadas e notificações.
 */
const streams = new Map<string, Set<Response>>();

export function subscribe(userId: string, res: Response): () => void {
  const set = streams.get(userId) ?? new Set<Response>();
  set.add(res);
  streams.set(userId, set);
  return () => {
    set.delete(res);
    if (set.size === 0) streams.delete(userId);
  };
}

export function publish(userId: string, event: { type: string; [key: string]: unknown }): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of streams.get(userId) ?? []) res.write(data);
}

export function isConnected(userId: string): boolean {
  return (streams.get(userId)?.size ?? 0) > 0;
}

// Mantém as conexões vivas atrás de proxies (Caddy, Cloudflare...).
setInterval(() => {
  for (const set of streams.values()) for (const res of set) res.write(': ping\n\n');
}, 25_000).unref();
