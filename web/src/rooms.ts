const ROOM_NAME = /^[a-z0-9_-]{1,64}$/;
const RECENT_KEY = 'kamus:recent-rooms';
const MAX_RECENT = 5;

/** "Amigos da Firma!" → "amigos-da-firma" (mesmas regras do servidor). */
export function normalizeRoomName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64);
}

export function isValidRoomName(room: string): boolean {
  return ROOM_NAME.test(room);
}

export function randomRoomId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** Link permanente da sala: /s/<sala>. Quem abre entra assistindo. */
export function roomPath(room: string): string {
  return `/s/${encodeURIComponent(room)}`;
}

/** Sala do link atual: /s/<sala> (ou o formato antigo ?sala=). */
export function readRoomFromUrl(): string | null {
  const { pathname, search } = window.location;
  const match = pathname.match(/^\/s\/([^/]+)\/?$/);
  const raw = match ? decodeURIComponent(match[1]) : new URLSearchParams(search).get('sala');
  if (!raw) return null;
  const room = normalizeRoomName(raw);
  return isValidRoomName(room) ? room : null;
}

export function loadRecentRooms(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((r) => typeof r === 'string' && isValidRoomName(r)) : [];
  } catch {
    return [];
  }
}

export function rememberRoom(room: string): void {
  try {
    const list = [room, ...loadRecentRooms().filter((r) => r !== room)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Sem armazenamento local (aba anônima etc.): só não lembra a sala.
  }
}

export function forgetRoom(room: string): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(loadRecentRooms().filter((r) => r !== room)));
  } catch {
    // idem
  }
}
