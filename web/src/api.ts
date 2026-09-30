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

export function fetchToken(room: string, name: string, role: Role): Promise<TokenResponse> {
  return request('/api/token', json({ room, name, role }));
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

export function fetchFriends(): Promise<{ online: OnlineFriend[]; recent: OfflineFriend[] }> {
  return request('/api/friends');
}
