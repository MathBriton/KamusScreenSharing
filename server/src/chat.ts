import { randomUUID } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db, uploadsDir } from './db.js';
import { HttpError, broadcast, type Caller } from './livekit.js';
import { sniffImage } from './images.js';

export const CHAT_TOPIC = 'chat';
export const MAX_TEXT = 2000;
export const HISTORY_LIMIT = 500;
const MAX_ATTACHMENTS = 10;

export interface Attachment {
  id: string;
  url: string;
  mime: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  identity: string;
  author: string;
  text: string;
  createdAt: number;
  attachments: Attachment[];
}

interface MessageRow {
  id: string;
  identity: string;
  author: string;
  text: string;
  created_at: number;
}

interface AttachmentRow {
  id: string;
  message_id: string | null;
  room: string;
  identity: string;
  mime: string;
  size: number;
}

const toAttachment = (a: AttachmentRow): Attachment => ({
  id: a.id,
  url: `/api/uploads/${a.id}`,
  mime: a.mime,
  size: a.size,
});

/** Últimas mensagens da sala, da mais antiga para a mais nova. */
export function listMessages(room: string, limit = HISTORY_LIMIT): ChatMessage[] {
  const rows = db
    .prepare(
      `SELECT id, identity, author, text, created_at FROM (
         SELECT * FROM messages WHERE room = ? ORDER BY created_at DESC, rowid DESC LIMIT ?
       ) ORDER BY created_at ASC`,
    )
    .all(room, limit) as unknown as MessageRow[];
  if (rows.length === 0) return [];

  const placeholders = rows.map(() => '?').join(',');
  const attachments = db
    .prepare(`SELECT * FROM attachments WHERE message_id IN (${placeholders}) ORDER BY created_at`)
    .all(...rows.map((r) => r.id)) as unknown as AttachmentRow[];
  const byMessage = new Map<string, Attachment[]>();
  for (const a of attachments) {
    const list = byMessage.get(a.message_id!) ?? [];
    list.push(toAttachment(a));
    byMessage.set(a.message_id!, list);
  }

  return rows.map((r) => ({
    id: r.id,
    identity: r.identity,
    author: r.author,
    text: r.text,
    createdAt: r.created_at,
    attachments: byMessage.get(r.id) ?? [],
  }));
}

export async function postMessage(caller: Caller, text: unknown, attachmentIds: unknown): Promise<ChatMessage> {
  const body = typeof text === 'string' ? text.trim() : '';
  const ids = Array.isArray(attachmentIds) ? attachmentIds.filter((x): x is string => typeof x === 'string') : [];
  if (body.length > MAX_TEXT) throw new HttpError(400, `Mensagem longa demais (máx. ${MAX_TEXT} caracteres).`);
  if (ids.length > MAX_ATTACHMENTS) throw new HttpError(400, `No máximo ${MAX_ATTACHMENTS} imagens por mensagem.`);
  if (!body && ids.length === 0) throw new HttpError(400, 'Mensagem vazia.');

  // Só anexa imagens enviadas pela mesma pessoa, na mesma sala, e ainda não usadas.
  const find = db.prepare('SELECT * FROM attachments WHERE id = ?');
  const attachments = ids.map((id) => {
    const a = find.get(id) as unknown as AttachmentRow | undefined;
    if (!a || a.room !== caller.room || a.identity !== caller.identity || a.message_id) {
      throw new HttpError(400, 'Imagem inválida.');
    }
    return a;
  });

  const message: ChatMessage = {
    id: randomUUID(),
    identity: caller.identity,
    author: caller.name,
    text: body,
    createdAt: Date.now(),
    attachments: attachments.map(toAttachment),
  };

  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO messages (id, room, identity, author, text, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      message.id,
      caller.room,
      message.identity,
      message.author,
      message.text,
      message.createdAt,
    );
    const link = db.prepare('UPDATE attachments SET message_id = ? WHERE id = ?');
    for (const a of attachments) link.run(message.id, a.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  await broadcast(caller.room, CHAT_TOPIC, { type: 'message', message });
  return message;
}

export function saveUpload(caller: Caller, body: unknown): Attachment {
  if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(400, 'Arquivo vazio.');
  const mime = sniffImage(body);
  if (!mime) throw new HttpError(415, 'Formato não suportado (use PNG, JPEG, GIF ou WebP).');

  const row: AttachmentRow = {
    id: randomUUID(),
    message_id: null,
    room: caller.room,
    identity: caller.identity,
    mime,
    size: body.length,
  };
  writeFileSync(path.join(uploadsDir, row.id), body);
  db.prepare('INSERT INTO attachments (id, room, identity, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    row.id,
    row.room,
    row.identity,
    row.mime,
    row.size,
    Date.now(),
  );
  return toAttachment(row);
}

export function findUpload(id: string): { file: string; mime: string } | null {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const row = db.prepare('SELECT mime FROM attachments WHERE id = ?').get(id) as { mime: string } | undefined;
  return row ? { file: path.join(uploadsDir, id), mime: row.mime } : null;
}

/** Apaga o que passou do prazo de retenção e uploads que nunca viraram mensagem. */
export function cleanup(now = Date.now()): void {
  const cutoff = now - config.retentionDays * 24 * 60 * 60 * 1000;
  const orphanCutoff = now - 24 * 60 * 60 * 1000;
  const expired = db
    .prepare(
      `SELECT a.id FROM attachments a LEFT JOIN messages m ON m.id = a.message_id
       WHERE (a.message_id IS NULL AND a.created_at < ?) OR m.created_at < ?`,
    )
    .all(orphanCutoff, cutoff) as { id: string }[];
  for (const { id } of expired) rmSync(path.join(uploadsDir, id), { force: true });

  const delAttachment = db.prepare('DELETE FROM attachments WHERE id = ?');
  for (const { id } of expired) delAttachment.run(id);
  const messages = db.prepare('DELETE FROM messages WHERE created_at < ?').run(cutoff);
  const people = db.prepare('DELETE FROM people WHERE last_seen < ?').run(cutoff);
  if (expired.length || Number(messages.changes) || Number(people.changes)) {
    console.log(
      `Limpeza: ${messages.changes} mensagens, ${expired.length} imagens, ${people.changes} pessoas (>${config.retentionDays} dias).`,
    );
  }
}
