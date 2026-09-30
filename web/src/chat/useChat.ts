import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RoomEvent, type Room } from 'livekit-client';
import { toast } from 'sonner';
import { chatApi, type ChatMessage } from '@/api';
import { subscribeNotices } from '@/notices';
import { mentions } from './mentions';

export const CHAT_TOPIC = 'chat';

export type ChatItem =
  | ({ kind: 'message'; isLocal: boolean; mentionsMe: boolean } & ChatMessage)
  | { kind: 'system'; id: string; text: string; createdAt: number };

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

function sortPins(list: ChatMessage[]): ChatMessage[] {
  return list.filter((m) => m.pinned).sort((a, b) => b.pinned!.at - a.pinned!.at);
}

interface Options {
  /** Chamado quando chega (em tempo real) uma mensagem de outra pessoa que menciona você. */
  onMention?: (message: ChatMessage) => void;
  /** Chamado para cada mensagem nova de outra pessoa (ex.: tirar o "digitando…"). */
  onRemoteMessage?: (message: ChatMessage) => void;
}

/**
 * Chat persistente: o histórico vem da API; mensagens novas e fixações chegam pelo
 * LiveKit (o servidor grava e repassa para a sala).
 */
export function useChat(room: Room, roomName: string, token: string | null, options: Options = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pins, setPins] = useState<ChatMessage[]>([]);
  const [notices, setNotices] = useState<Extract<ChatItem, { kind: 'system' }>[]>([]);
  const [loaded, setLoaded] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const merge = useCallback((incoming: ChatMessage[]) => setMessages((prev) => mergeMessages(prev, incoming)), []);
  const updatePin = useCallback((message: ChatMessage) => {
    setPins((prev) => sortPins([...prev.filter((m) => m.id !== message.id), message]));
    // Só atualiza no histórico se a mensagem já estiver carregada.
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
  }, []);

  // Escuta antes de buscar o histórico, para não perder mensagens no meio.
  useEffect(() => {
    const onData = (payload: Uint8Array, _p: unknown, _k: unknown, topic?: string) => {
      if (topic !== CHAT_TOPIC) return;
      try {
        const event = JSON.parse(new TextDecoder().decode(payload));
        const message: ChatMessage | undefined = event?.message;
        if (!message?.id) return;
        if (event.type === 'pin') {
          updatePin(message);
          return;
        }
        if (event.type !== 'message') return;
        merge([message]);
        const local = room.localParticipant;
        if (message.identity !== local.identity) {
          optionsRef.current.onRemoteMessage?.(message);
          if (mentions(message.text, local.name ?? '')) optionsRef.current.onMention?.(message);
        }
      } catch {
        // Pacote malformado: ignora.
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, merge, updatePin]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([chatApi.history(roomName, token), chatApi.pins(roomName, token)])
      .then(([history, pinned]) => {
        if (cancelled) return;
        merge(history);
        setPins(sortPins(pinned));
      })
      .catch(
        (err) =>
          !cancelled && toast.error('Não foi possível carregar o histórico', { description: String(err.message ?? err) }),
      )
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
    async (text: string, files: File[], replyTo?: string) => {
      if (!token) throw new Error('Ainda conectando.');
      const ids: string[] = [];
      for (const file of files) ids.push((await chatApi.upload(roomName, token, file)).id);
      merge([await chatApi.send(roomName, token, text, ids, replyTo)]);
    },
    [roomName, token, merge],
  );

  const setPinned = useCallback(
    async (id: string, pinned: boolean) => {
      if (!token) return;
      try {
        updatePin(await chatApi.pin(roomName, token, id, pinned));
      } catch (err) {
        toast.error(pinned ? 'Não foi possível fixar' : 'Não foi possível desafixar', {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [roomName, token, updatePin],
  );

  const localIdentity = room.localParticipant.identity;
  const localName = room.localParticipant.name ?? '';
  const items = useMemo<ChatItem[]>(
    () =>
      [
        ...messages.map((m) => ({
          ...m,
          kind: 'message' as const,
          isLocal: m.identity === localIdentity,
          mentionsMe: m.identity !== localIdentity && mentions(m.text, localName),
        })),
        ...notices,
      ].sort((a, b) => a.createdAt - b.createdAt),
    [messages, notices, localIdentity, localName],
  );

  return { items, messages, pins, loaded, send, setPinned };
}
