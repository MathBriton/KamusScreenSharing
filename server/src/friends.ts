import { TrackSource } from 'livekit-server-sdk';
import { roomService } from './livekit.js';
import { listUsers, touchUser } from './users.js';

export interface Presence {
  room: string;
  live: boolean;
}

export interface Friend {
  id: string;
  name: string;
  online: boolean;
  /** Salas em que está agora (pode estar em mais de uma aba). */
  rooms: Presence[];
  lastSeen: number;
  lastRoom: string | null;
}

export interface ActiveRoom {
  room: string;
  people: { name: string; live: boolean }[];
}

/** Quem está em cada sala agora, a partir do LiveKit. */
async function snapshot(): Promise<{ byUser: Map<string, Presence[]>; rooms: ActiveRoom[] }> {
  const byUser = new Map<string, Presence[]>();
  const rooms: ActiveRoom[] = [];
  for (const room of await roomService.listRooms()) {
    // Não confia em room.numParticipants: o LiveKit atualiza essa contagem com atraso.
    const participants = await roomService.listParticipants(room.name);
    if (participants.length === 0) continue;
    const people = participants.map((p) => {
      const live = p.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE);
      const userId = p.attributes.userId;
      if (userId) byUser.set(userId, [...(byUser.get(userId) ?? []), { room: room.name, live }]);
      return { name: p.name || p.identity, live };
    });
    rooms.push({ room: room.name, people });
  }
  rooms.sort((a, b) => b.people.length - a.people.length || a.room.localeCompare(b.room));
  return { byUser, rooms };
}

/** Todos os perfis do servidor, com quem está online (e onde) primeiro. */
export async function listFriends(): Promise<Friend[]> {
  const { byUser } = await snapshot();
  const now = Date.now();
  const friends = listUsers().map((u) => {
    const rooms = byUser.get(u.id) ?? [];
    if (rooms.length) touchUser(u.id, rooms[0].room, now);
    return {
      id: u.id,
      name: u.name,
      online: rooms.length > 0,
      rooms,
      lastSeen: rooms.length ? now : u.lastSeen,
      lastRoom: rooms[0]?.room ?? u.lastRoom,
    };
  });
  return friends.sort(
    (a, b) =>
      Number(b.online) - Number(a.online) ||
      Number(b.rooms.some((r) => r.live)) - Number(a.rooms.some((r) => r.live)) ||
      b.lastSeen - a.lastSeen,
  );
}

export async function listActiveRooms(): Promise<ActiveRoom[]> {
  return (await snapshot()).rooms;
}

/** Quem (perfil) está conectado numa sala. */
export async function usersInRoom(room: string): Promise<Set<string>> {
  try {
    return new Set((await roomService.listParticipants(room)).map((p) => p.attributes.userId).filter(Boolean));
  } catch {
    return new Set();
  }
}
