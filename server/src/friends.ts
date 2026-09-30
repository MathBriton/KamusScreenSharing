import { TrackSource } from 'livekit-server-sdk';
import { db } from './db.js';
import { roomService } from './livekit.js';

export interface OnlineFriend {
  identity: string;
  name: string;
  room: string;
  live: boolean;
}

export interface OfflineFriend {
  name: string;
  lastSeen: number;
  lastRoom: string | null;
}

const nameKey = (name: string) => name.trim().toLocaleLowerCase('pt-BR');

export function touchPerson(name: string, room: string, at = Date.now()): void {
  db.prepare(
    `INSERT INTO people (name_key, name, last_seen, last_room) VALUES (?, ?, ?, ?)
     ON CONFLICT (name_key) DO UPDATE SET name = excluded.name, last_seen = excluded.last_seen, last_room = excluded.last_room`,
  ).run(nameKey(name), name, at, room);
}

/** Quem está online agora (em qualquer sala) e quem foi visto recentemente. */
export async function listFriends(): Promise<{ online: OnlineFriend[]; recent: OfflineFriend[] }> {
  const online: OnlineFriend[] = [];
  const rooms = await roomService.listRooms();
  for (const room of rooms) {
    // Não confia em room.numParticipants: o LiveKit atualiza essa contagem com atraso.
    for (const p of await roomService.listParticipants(room.name)) {
      const name = p.name || p.identity;
      online.push({
        identity: p.identity,
        name,
        room: room.name,
        live: p.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE),
      });
      touchPerson(name, room.name);
    }
  }
  online.sort((a, b) => Number(b.live) - Number(a.live) || a.name.localeCompare(b.name, 'pt-BR'));

  const onlineKeys = new Set(online.map((f) => nameKey(f.name)));
  const recent = (
    db.prepare('SELECT name, last_seen, last_room FROM people ORDER BY last_seen DESC LIMIT 100').all() as {
      name: string;
      last_seen: number;
      last_room: string | null;
    }[]
  )
    .filter((p) => !onlineKeys.has(nameKey(p.name)))
    .slice(0, 50)
    .map((p) => ({ name: p.name, lastSeen: p.last_seen, lastRoom: p.last_room }));

  return { online, recent };
}
