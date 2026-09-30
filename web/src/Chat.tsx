import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ConnectionState, type Room } from 'livekit-client';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Mantém a última mensagem visível (rola o viewport interno do ScrollArea).
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
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
    <section className="flex min-h-80 flex-1 flex-col p-4 md:min-h-0">
      <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Chat</h3>
      <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
        <ol className="flex flex-col gap-3 pr-3">
          {messages.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</li>}
          {messages.map((m) => (
            <li key={m.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <strong className={cn('font-medium', m.isLocal && 'text-blue-600 dark:text-blue-400')}>
                  {m.isLocal ? 'Você' : m.author}
                </strong>
                <time className="text-xs text-muted-foreground">
                  {m.at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              <p className="mt-0.5 break-words whitespace-pre-wrap">{m.text}</p>
            </li>
          ))}
        </ol>
      </ScrollArea>
      <form className="mt-3 flex gap-2" onSubmit={send}>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? 'Escreva uma mensagem…' : 'Conectando…'}
          maxLength={MAX_LENGTH}
          disabled={!connected}
          aria-label="Mensagem"
        />
        <Button type="submit" size="icon" disabled={!connected || !draft.trim()} aria-label="Enviar">
          <SendHorizontal />
        </Button>
      </form>
    </section>
  );
}
