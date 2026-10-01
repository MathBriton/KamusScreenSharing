export type Role = 'presenter' | 'viewer';

export interface TokenResponse {
  token: string;
  url: string;
}

export interface Attachment {
  id: string;
  url: string;
  mime: string;
  size: number;
}

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

export type SearchKind = 'all' | 'links' | 'images';

export interface User {
  id: string;
  name: string;
}

export interface Friend extends User {
  online: boolean;
  rooms: { room: string; live: boolean }[];
  lastSeen: number;
  lastRoom: string | null;
}

export interface ActiveRoom {
  room: string;
  people: { name: string; live: boolean }[];
}

export type NotificationKind = 'dm' | 'mention' | 'live';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  data: Record<string, string>;
  createdAt: number;
  read: boolean;
}

export interface DirectMessage {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  createdAt: number;
  read: boolean;
}

export interface ConversationSummary {
  peerId: string;
  last: DirectMessage;
  unread: number;
}

export interface Session {
  token: string;
  user: User;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Falha na requisição (HTTP ${res.status})`);
  }
  return body as T;
}

const json = (data: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

/** Token do LiveKit para entrar numa sala (o nome vem do perfil). */
export function fetchToken(room: string, sessionToken: string): Promise<TokenResponse> {
  return request('/api/token', json({ room }), sessionToken);
}

/** Avisa os amigos (sininho) que você começou a transmitir. */
export function announceLive(room: string, roomToken: string): Promise<unknown> {
  return request(`/api/rooms/${encodeURIComponent(room)}/live`, { method: 'POST' }, roomToken);
}

const roomUrl = (room: string, path: string) => `/api/rooms/${encodeURIComponent(room)}/${path}`;

export const chatApi = {
  async history(room: string, token: string): Promise<ChatMessage[]> {
    const { messages } = await request<{ messages: ChatMessage[] }>(roomUrl(room, 'messages'), {}, token);
    return messages;
  },
  async send(room: string, token: string, text: string, attachmentIds: string[], replyTo?: string): Promise<ChatMessage> {
    const { message } = await request<{ message: ChatMessage }>(
      roomUrl(room, 'messages'),
      json({ text, attachmentIds, replyTo }),
      token,
    );
    return message;
  },
  async pin(room: string, token: string, id: string, pinned: boolean): Promise<ChatMessage> {
    const { message } = await request<{ message: ChatMessage }>(
      roomUrl(room, `messages/${encodeURIComponent(id)}/pin`),
      json({ pinned }),
      token,
    );
    return message;
  },
  async pins(room: string, token: string): Promise<ChatMessage[]> {
    const { messages } = await request<{ messages: ChatMessage[] }>(roomUrl(room, 'pins'), {}, token);
    return messages;
  },
  async search(room: string, token: string, q: string, kind: SearchKind): Promise<ChatMessage[]> {
    const params = new URLSearchParams({ q, kind });
    const { messages } = await request<{ messages: ChatMessage[] }>(roomUrl(room, `search?${params}`), {}, token);
    return messages;
  },
  async upload(room: string, token: string, file: Blob): Promise<Attachment> {
    const { attachment } = await request<{ attachment: Attachment }>(
      roomUrl(room, 'uploads'),
      { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file },
      token,
    );
    return attachment;
  },
};

export async function fetchRoomInfo(room: string, token: string): Promise<{ createdAt: number | null }> {
  return request(roomUrl(room, 'info'), {}, token);
}

const patch = (data: unknown): RequestInit => ({ ...json(data), method: 'PATCH' });

export const authApi = {
  async exists(name: string): Promise<boolean> {
    return (await request<{ exists: boolean }>('/api/auth/check', json({ name }))).exists;
  },
  register: (name: string, pin: string) => request<Session>('/api/auth/register', json({ name, pin })),
  login: (name: string, pin: string) => request<Session>('/api/auth/login', json({ name, pin })),
  logout: (token: string) => request('/api/auth/logout', { method: 'POST' }, token),
  async me(token: string): Promise<User> {
    return (await request<{ user: User }>('/api/me', {}, token)).user;
  },
  async rename(token: string, name: string): Promise<User> {
    return (await request<{ user: User }>('/api/me', patch({ name }), token)).user;
  },
  changePin: (token: string, currentPin: string, newPin: string) =>
    request('/api/me/pin', json({ currentPin, newPin }), token),
};

export const accountApi = {
  async friends(token: string): Promise<Friend[]> {
    return (await request<{ friends: Friend[] }>('/api/friends', {}, token)).friends;
  },
  async activeRooms(token: string): Promise<ActiveRoom[]> {
    return (await request<{ rooms: ActiveRoom[] }>('/api/rooms/active', {}, token)).rooms;
  },
  async notifications(token: string): Promise<AppNotification[]> {
    return (await request<{ notifications: AppNotification[] }>('/api/me/notifications', {}, token)).notifications;
  },
  markNotificationsRead: (token: string, ids?: string[]) => request('/api/me/notifications/read', json({ ids }), token),
  async conversations(token: string): Promise<ConversationSummary[]> {
    return (await request<{ conversations: ConversationSummary[] }>('/api/me/conversations', {}, token)).conversations;
  },
  async dmHistory(token: string, peerId: string): Promise<DirectMessage[]> {
    return (await request<{ messages: DirectMessage[] }>(`/api/me/dm/${encodeURIComponent(peerId)}`, {}, token)).messages;
  },
  async sendDm(token: string, peerId: string, text: string): Promise<DirectMessage> {
    return (await request<{ message: DirectMessage }>(`/api/me/dm/${encodeURIComponent(peerId)}`, json({ text }), token))
      .message;
  },
  markDmRead: (token: string, peerId: string) =>
    request(`/api/me/dm/${encodeURIComponent(peerId)}/read`, { method: 'POST' }, token),
  eventsUrl: (token: string) => `/api/me/events?token=${encodeURIComponent(token)}`,
};
