import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { publish } from './events.js';

export type NotificationKind = 'dm' | 'mention' | 'live';

export interface Notification {
  id: string;
  kind: NotificationKind;
  /** dm: {fromId, fromName, preview} · mention: {room, fromName, preview, messageId} · live: {room, fromId, fromName} */
  data: Record<string, string>;
  createdAt: number;
  read: boolean;
}

interface Row {
  id: string;
  kind: NotificationKind;
  data: string;
  created_at: number;
  read_at: number | null;
}

const toNotification = (r: Row): Notification => ({
  id: r.id,
  kind: r.kind,
  data: JSON.parse(r.data),
  createdAt: r.created_at,
  read: r.read_at !== null,
});

export function notify(userId: string, kind: NotificationKind, data: Record<string, string>): Notification {
  const n: Notification = { id: randomUUID(), kind, data, createdAt: Date.now(), read: false };
  db.prepare('INSERT INTO notifications (id, user_id, kind, data, created_at) VALUES (?, ?, ?, ?, ?)').run(
    n.id,
    userId,
    kind,
    JSON.stringify(data),
    n.createdAt,
  );
  publish(userId, { type: 'notification', notification: n });
  return n;
}

export function listNotifications(userId: string): Notification[] {
  return (
    db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(userId) as unknown as Row[]
  ).map(toNotification);
}

/** Marca como lidas: todas, ou só as de uma conversa privada. */
export function markNotificationsRead(userId: string, filter: { ids?: unknown; dmFrom?: string } = {}): void {
  const now = Date.now();
  if (filter.dmFrom) {
    db.prepare(
      `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND kind = 'dm'
       AND json_extract(data, '$.fromId') = ?`,
    ).run(now, userId, filter.dmFrom);
  } else if (Array.isArray(filter.ids)) {
    const mark = db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND id = ? AND read_at IS NULL');
    for (const id of filter.ids) if (typeof id === 'string') mark.run(now, userId, id);
  } else {
    db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now, userId);
  }
  publish(userId, { type: 'notifications-read' });
}

// "Fulano está ao vivo": no máximo um aviso por pessoa e sala a cada 10 minutos.
const lastLive = new Map<string, number>();
const LIVE_THROTTLE_MS = 10 * 60 * 1000;

export function shouldNotifyLive(fromId: string, room: string): boolean {
  const key = `${fromId}:${room}`;
  const last = lastLive.get(key) ?? 0;
  if (Date.now() - last < LIVE_THROTTLE_MS) return false;
  lastLive.set(key, Date.now());
  return true;
}
