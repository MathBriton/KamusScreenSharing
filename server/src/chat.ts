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

/** Trecho da mensagem citada numa resposta. */
export interface ReplyPreview {
  id: string;
  author: string;
  text: string;
  hasImage: boolean;
}

export interface ChatMessage {
  id: string;
  identity: string;
  author: string;
  text: string;
  createdAt: number;
  attachments: Attachment[];
  replyTo: ReplyPreview | null;
  pinned: { at: number; by: string } | null;
}

interface MessageRow {
  id: string;
  identity: string;
  author: string;
  text: string;
  created_at: number;
  reply_to: string | null;
  pinned_at: number | null;
  pinned_by: string | null;
  reply_author: string | null;
  reply_text: string | null;
  reply_images: number | null;
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

/** Colunas da mensagem + resumo da mensagem citada (alias "m" e "r"). */
const SELECT_MESSAGE = `
  SELECT m.id, m.identity, m.author, m.text, m.created_at, m.reply_to, m.pinned_at, m.pinned_by,
         r.author AS reply_author, r.text AS reply_text,
         (SELECT COUNT(*) FROM attachments ra WHERE ra.message_id = r.id) AS reply_images
  FROM messages m
  LEFT JOIN messages r ON r.id = m.reply_to`;

const SNIPPET = 140;

/** Junta anexos, citação e fixação às linhas do banco. */
function hydrate(rows: MessageRow[]): ChatMessage[] {
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
    replyTo:
      r.reply_to && r.reply_author !== null
        ? {
            id: r.reply_to,
            author: r.reply_author,
            text: (r.reply_text ?? '').slice(0, SNIPPET),
            hasImage: (r.reply_images ?? 0) > 0,
          }
        : null,
    pinned: r.pinned_at ? { at: r.pinned_at, by: r.pinned_by ?? '' } : null,
  }));
}

/** Últimas mensagens da sala, da mais antiga para a mais nova. */
export function listMessages(room: string, limit = HISTORY_LIMIT): ChatMessage[] {
  const rows = db
    .prepare(`${SELECT_MESSAGE} WHERE m.room = ? ORDER BY m.created_at DESC, m.rowid DESC LIMIT ?`)
    .all(room, limit) as unknown as MessageRow[];
  return hydrate(rows.reverse());
}

function findMessage(room: string, id: string): ChatMessage | null {
  const row = db.prepare(`${SELECT_MESSAGE} WHERE m.room = ? AND m.id = ?`).get(room, id) as unknown as
    | MessageRow
    | undefined;
  return row ? hydrate([row])[0] : null;
}

/** Mensagens fixadas (não expiram), da fixada mais recente para a mais antiga. */
export function listPinned(room: string): ChatMessage[] {
  const rows = db
    .prepare(`${SELECT_MESSAGE} WHERE m.room = ? AND m.pinned_at IS NOT NULL ORDER BY m.pinned_at DESC LIMIT 50`)
    .all(room) as unknown as MessageRow[];
  return hydrate(rows);
}

export async function setPinned(caller: Caller, id: string, pinned: unknown): Promise<ChatMessage> {
  if (typeof pinned !== 'boolean') throw new HttpError(400, 'Informe "pinned": true ou false.');
  const result = db
    .prepare('UPDATE messages SET pinned_at = ?, pinned_by = ? WHERE room = ? AND id = ?')
    .run(pinned ? Date.now() : null, pinned ? caller.name : null, caller.room, id);
  if (Number(result.changes) === 0) throw new HttpError(404, 'Mensagem não encontrada.');
  const message = findMessage(caller.room, id)!;
  await broadcast(caller.room, CHAT_TOPIC, { type: 'pin', message });
  return message;
}

export type SearchKind = 'all' | 'links' | 'images';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Busca no histórico inteiro da sala (texto e autor), com filtro de links ou imagens. */
export function searchMessages(room: string, query: unknown, kind: unknown): ChatMessage[] {
  const q = typeof query === 'string' ? query.trim().slice(0, 100) : '';
  const k: SearchKind = kind === 'links' || kind === 'images' ? kind : 'all';
  if (!q && k === 'all') return [];

  const where = ['m.room = ?'];
  const params: (string | number)[] = [room];
  if (q) {
    where.push("(m.text LIKE ? ESCAPE '\\' OR m.author LIKE ? ESCAPE '\\')");
    const like = `%${escapeLike(q)}%`;
    params.push(like, like);
  }
  if (k === 'links') where.push("m.text LIKE '%http%'");
  if (k === 'images') {
    where.push(`(EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = m.id)
      OR m.text LIKE '%.gif%' OR m.text LIKE '%.png%' OR m.text LIKE '%.jpg%' OR m.text LIKE '%.jpeg%'
      OR m.text LIKE '%.webp%' OR m.text LIKE '%giphy.com%' OR m.text LIKE '%tenor.com%')`);
  }
  const rows = db
    .prepare(`${SELECT_MESSAGE} WHERE ${where.join(' AND ')} ORDER BY m.created_at DESC LIMIT 50`)
    .all(...params) as unknown as MessageRow[];
  return hydrate(rows);
}

export async function postMessage(
  caller: Caller,
  text: unknown,
  attachmentIds: unknown,
  replyTo?: unknown,
): Promise<ChatMessage> {
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

  // Resposta: a mensagem citada precisa existir nesta sala.
  const replyId = typeof replyTo === 'string' && replyTo ? replyTo : null;
  if (replyId && !db.prepare('SELECT 1 FROM messages WHERE room = ? AND id = ?').get(caller.room, replyId)) {
    throw new HttpError(400, 'A mensagem respondida não existe mais.');
  }

  const id = randomUUID();

  db.exec('BEGIN');
  try {
    db.prepare(
      'INSERT INTO messages (id, room, identity, author, text, created_at, reply_to) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, caller.room, caller.identity, caller.name, body, Date.now(), replyId);
    const link = db.prepare('UPDATE attachments SET message_id = ? WHERE id = ?');
    for (const a of attachments) link.run(id, a.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const message = findMessage(caller.room, id)!;
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
       WHERE (a.message_id IS NULL AND a.created_at < ?) OR (m.created_at < ? AND m.pinned_at IS NULL)`,
    )
    .all(orphanCutoff, cutoff) as { id: string }[];
  for (const { id } of expired) rmSync(path.join(uploadsDir, id), { force: true });

  const delAttachment = db.prepare('DELETE FROM attachments WHERE id = ?');
  for (const { id } of expired) delAttachment.run(id);
  // Mensagens fixadas não expiram (guardam material importante do grupo).
  const messages = db.prepare('DELETE FROM messages WHERE created_at < ? AND pinned_at IS NULL').run(cutoff);
  const people = db.prepare('DELETE FROM people WHERE last_seen < ?').run(cutoff);
  if (expired.length || Number(messages.changes) || Number(people.changes)) {
    console.log(
      `Limpeza: ${messages.changes} mensagens, ${expired.length} imagens, ${people.changes} pessoas (>${config.retentionDays} dias).`,
    );
  }
}
