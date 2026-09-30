import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ConnectionState, type Room } from 'livekit-client';

const CHAT_TOPIC = 'chat';
const MAX_LENGTH = 1000;

interface ChatMessage {
  id: string;
  author: string;
  text: string;
  at: Date;
  isLocal: boolean;
}

interface Props {
  room: Room;
  connected: boolean;
}

export function Chat({ room, connected }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    room.registerTextStreamHandler(CHAT_TOPIC, async (reader, { identity }) => {
      const text = await reader.readAll();
      const author = room.getParticipantByIdentity(identity)?.name || 'Anônimo';
      setMessages((prev) => [
        ...prev,
        { id: reader.info.id, author, text, at: new Date(reader.info.timestamp), isLocal: false },
      ]);
    });
    return () => room.unregisterTextStreamHandler(CHAT_TOPIC);
  }, [room]);

  // Mantém a última mensagem visível.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim().slice(0, MAX_LENGTH);
    if (!text || room.state !== ConnectionState.Connected) return;
    setDraft('');
    const info = await room.localParticipant.sendText(text, { topic: CHAT_TOPIC });
    setMessages((prev) => [
      ...prev,
      { id: info.id, author: room.localParticipant.name || 'Você', text, at: new Date(), isLocal: true },
    ]);
  };

  return (
    <section className="panel chat">
      <h3>Chat</h3>
      <ol className="messages" ref={listRef}>
        {messages.length === 0 && <li className="muted">Nenhuma mensagem ainda.</li>}
        {messages.map((m) => (
          <li key={m.id} className={m.isLocal ? 'mine' : undefined}>
            <div className="message-meta">
              <strong>{m.isLocal ? 'Você' : m.author}</strong>
              <time>{m.at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
            <p>{m.text}</p>
          </li>
        ))}
      </ol>
      <form className="chat-form" onSubmit={send}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? 'Escreva uma mensagem…' : 'Conectando…'}
          maxLength={MAX_LENGTH}
          disabled={!connected}
          aria-label="Mensagem"
        />
        <button type="submit" disabled={!connected || !draft.trim()}>
          Enviar
        </button>
      </form>
    </section>
  );
}
