import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { publish } from './events.js';
import { HttpError } from './livekit.js';
import { markNotificationsRead, notify } from './notifications.js';
import { findUser, type PublicUser } from './users.js';

const MAX_TEXT = 2000;

export interface DirectMessage {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  createdAt: number;
  read: boolean;
}

interface Row {
  id: string;
  from_id: string;
  to_id: string;
  text: string;
  created_at: number;
  read_at: number | null;
}

const toDm = (r: Row): DirectMessage => ({
  id: r.id,
  fromId: r.from_id,
  toId: r.to_id,
  text: r.text,
  createdAt: r.created_at,
  read: r.read_at !== null,
});

function peer(me: PublicUser, peerId: string): PublicUser {
  const other = findUser(peerId);
  if (!other) throw new HttpError(404, 'Amigo não encontrado.');
  if (other.id === me.id) throw new HttpError(400, 'Não dá para mandar mensagem para você mesmo.');
  return other;
}

export function sendDm(me: PublicUser, peerId: string, input: unknown): DirectMessage {
  const to = peer(me, peerId);
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) throw new HttpError(400, 'Mensagem vazia.');
  if (text.length > MAX_TEXT) throw new HttpError(400, `Mensagem longa demais (máx. ${MAX_TEXT} caracteres).`);

  const dm: DirectMessage = { id: randomUUID(), fromId: me.id, toId: to.id, text, createdAt: Date.now(), read: false };
  db.prepare('INSERT INTO direct_messages (id, from_id, to_id, text, created_at) VALUES (?, ?, ?, ?, ?)').run(
    dm.id,
    dm.fromId,
    dm.toId,
    dm.text,
    dm.createdAt,
  );
  // As duas pontas recebem em tempo real (inclusive outras abas de quem enviou).
  publish(to.id, { type: 'dm', message: dm, from: me });
  publish(me.id, { type: 'dm', message: dm, from: me });
  notify(to.id, 'dm', { fromId: me.id, fromName: me.name, preview: text.slice(0, 140) });
  return dm;
}

/** Conversa com um amigo, da mais antiga para a mais nova (últimas 200). */
export function conversation(me: PublicUser, peerId: string): DirectMessage[] {
  const other = peer(me, peerId);
  const rows = db
    .prepare(
      `SELECT * FROM direct_messages
       WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
       ORDER BY created_at DESC LIMIT 200`,
    )
    .all(me.id, other.id, other.id, me.id) as unknown as Row[];
  return rows.reverse().map(toDm);
}

export function markConversationRead(me: PublicUser, peerId: string): void {
  db.prepare('UPDATE direct_messages SET read_at = ? WHERE to_id = ? AND from_id = ? AND read_at IS NULL').run(
    Date.now(),
    me.id,
    peerId,
  );
  markNotificationsRead(me.id, { dmFrom: peerId });
}

export interface ConversationSummary {
  peerId: string;
  last: DirectMessage;
  unread: number;
}

/** Uma linha por amigo com quem há conversa: última mensagem e não lidas. */
export function conversations(me: PublicUser): ConversationSummary[] {
  const rows = db
    .prepare(
      `SELECT * FROM direct_messages WHERE from_id = ? OR to_id = ? ORDER BY created_at DESC LIMIT 2000`,
    )
    .all(me.id, me.id) as unknown as Row[];
  const byPeer = new Map<string, ConversationSummary>();
  for (const r of rows) {
    const peerId = r.from_id === me.id ? r.to_id : r.from_id;
    const entry = byPeer.get(peerId) ?? { peerId, last: toDm(r), unread: 0 };
    if (r.to_id === me.id && r.read_at === null) entry.unread += 1;
    byPeer.set(peerId, entry);
  }
  return [...byPeer.values()];
}
