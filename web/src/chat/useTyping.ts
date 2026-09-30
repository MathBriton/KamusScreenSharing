import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomEvent, type RemoteParticipant, type Room } from 'livekit-client';

const TOPIC = 'typing';
/** Quanto tempo o aviso dura sem novo sinal. */
const TTL_MS = 4000;
/** Intervalo mínimo entre sinais enviados. */
const THROTTLE_MS = 2000;

/**
 * "Fulano está digitando…": sinais efêmeros pelo LiveKit (não passam pelo servidor
 * nem são gravados).
 */
export function useTyping(room: Room) {
  const [typing, setTyping] = useState<Map<string, { name: string; until: number }>>(new Map());
  const lastSent = useRef(0);

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC || !participant) return;
      try {
        const { typing: isTyping } = JSON.parse(new TextDecoder().decode(payload));
        setTyping((prev) => {
          const next = new Map(prev);
          if (isTyping) next.set(participant.identity, { name: participant.name || 'Alguém', until: Date.now() + TTL_MS });
          else next.delete(participant.identity);
          return next;
        });
      } catch {
        // Pacote malformado: ignora.
      }
    };
    const onLeft = (participant: RemoteParticipant) =>
      setTyping((prev) => {
        if (!prev.has(participant.identity)) return prev;
        const next = new Map(prev);
        next.delete(participant.identity);
        return next;
      });
    room.on(RoomEvent.DataReceived, onData).on(RoomEvent.ParticipantDisconnected, onLeft);
    const prune = setInterval(
      () =>
        setTyping((prev) => {
          const now = Date.now();
          if (![...prev.values()].some((t) => t.until < now)) return prev;
          return new Map([...prev].filter(([, t]) => t.until >= now));
        }),
      1000,
    );
    return () => {
      room.off(RoomEvent.DataReceived, onData).off(RoomEvent.ParticipantDisconnected, onLeft);
      clearInterval(prune);
    };
  }, [room]);

  const send = useCallback(
    (isTyping: boolean) => {
      const data = new TextEncoder().encode(JSON.stringify({ typing: isTyping }));
      void room.localParticipant.publishData(data, { reliable: false, topic: TOPIC }).catch(() => {});
    },
    [room],
  );

  /** Chamar a cada tecla: envia no máximo um sinal a cada 2 s. */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current < THROTTLE_MS) return;
    lastSent.current = now;
    send(true);
  }, [send]);

  /** Parou (enviou a mensagem ou apagou o texto). */
  const stopTyping = useCallback(() => {
    if (lastSent.current === 0) return;
    lastSent.current = 0;
    send(false);
  }, [send]);

  /** Some da lista quem acabou de mandar mensagem. */
  const clearTyping = useCallback(
    (identity: string) =>
      setTyping((prev) => {
        if (!prev.has(identity)) return prev;
        const next = new Map(prev);
        next.delete(identity);
        return next;
      }),
    [],
  );

  const names = [...typing.values()].map((t) => t.name);
  return { typingNames: names, notifyTyping, stopTyping, clearTyping };
}

export function typingLabel(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} está digitando…`;
  if (names.length === 2) return `${names[0]} e ${names[1]} estão digitando…`;
  return `${names.length} pessoas estão digitando…`;
}
