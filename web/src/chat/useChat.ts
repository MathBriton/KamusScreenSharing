import { useCallback, useEffect, useMemo, useState } from 'react';
import { RoomEvent, type Room } from 'livekit-client';
import { toast } from 'sonner';
import { chatApi, type ChatMessage } from '@/api';
import { subscribeNotices } from '@/notices';

export const CHAT_TOPIC = 'chat';

export type ChatItem =
  | ({ kind: 'message'; isLocal: boolean } & ChatMessage)
  | { kind: 'system'; id: string; text: string; createdAt: number };

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Chat persistente: o histórico vem da API; mensagens novas chegam pelo LiveKit
 * (o servidor grava e repassa para a sala).
 */
export function useChat(room: Room, roomName: string, token: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notices, setNotices] = useState<Extract<ChatItem, { kind: 'system' }>[]>([]);
  const [loaded, setLoaded] = useState(false);

  const merge = useCallback((incoming: ChatMessage[]) => setMessages((prev) => mergeMessages(prev, incoming)), []);

  // Escuta antes de buscar o histórico, para não perder mensagens no meio.
  useEffect(() => {
    const onData = (payload: Uint8Array, _p: unknown, _k: unknown, topic?: string) => {
      if (topic !== CHAT_TOPIC) return;
      try {
        const event = JSON.parse(new TextDecoder().decode(payload));
        if (event?.type === 'message' && event.message?.id) merge([event.message]);
      } catch {
        // Pacote malformado: ignora.
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, merge]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    chatApi
      .history(roomName, token)
      .then((history) => !cancelled && merge(history))
      .catch((err) => !cancelled && toast.error('Não foi possível carregar o histórico', { description: String(err.message ?? err) }))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [roomName, token, merge]);

  // Entradas, saídas e transmissões aparecem como linhas de sistema (não são gravadas).
  useEffect(
    () =>
      subscribeNotices(room, (n) =>
        setNotices((prev) => [...prev, { kind: 'system', id: crypto.randomUUID(), text: n.text, createdAt: Date.now() }]),
      ),
    [room],
  );

  const send = useCallback(
    async (text: string, files: File[]) => {
      if (!token) throw new Error('Ainda conectando.');
      const ids: string[] = [];
      for (const file of files) ids.push((await chatApi.upload(roomName, token, file)).id);
      merge([await chatApi.send(roomName, token, text, ids)]);
    },
    [roomName, token, merge],
  );

  const localIdentity = room.localParticipant.identity;
  const items = useMemo<ChatItem[]>(
    () =>
      [
        ...messages.map((m) => ({ ...m, kind: 'message' as const, isLocal: m.identity === localIdentity })),
        ...notices,
      ].sort((a, b) => a.createdAt - b.createdAt),
    [messages, notices, localIdentity],
  );

  return { items, messages, loaded, send };
}
