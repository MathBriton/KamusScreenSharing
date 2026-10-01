import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Loader2, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { accountApi, type DirectMessage } from '@/api';
import { formatTime } from '@/chat/links';
import { MessageText } from '@/chat/MessageText';
import { cn } from '@/lib/utils';
import { useAccount } from './AccountContext';

/** Conversa privada num painel lateral, disponível na home e dentro das salas. */
export function DmPanel() {
  const { session, dmPeer, closeDm, onDm, markDmRead } = useAccount();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const token = session?.token;
  const me = session?.user.id;
  const peerId = dmPeer?.id;

  useEffect(() => {
    setMessages([]);
    setText('');
    if (!token || !peerId) return;
    setLoading(true);
    let cancelled = false;
    accountApi
      .dmHistory(token, peerId)
      .then((history) => !cancelled && setMessages(history))
      .catch((err) => !cancelled && toast.error('Não foi possível abrir a conversa', { description: String(err.message ?? err) }))
      .finally(() => !cancelled && setLoading(false));
    markDmRead(peerId);
    return () => {
      cancelled = true;
    };
  }, [token, peerId, markDmRead]);

  // Mensagens novas desta conversa chegam em tempo real.
  useEffect(() => {
    if (!peerId) return;
    return onDm((m) => {
      if (m.fromId !== peerId && m.toId !== peerId) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (m.fromId === peerId) markDmRead(peerId);
    });
  }, [peerId, onDm, markDmRead]);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || !token || !peerId || sending) return;
    setSending(true);
    try {
      const m = await accountApi.sendDm(token, peerId, body);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setText('');
    } catch (err) {
      toast.error('Não foi possível enviar', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <Sheet open={!!dmPeer} onOpenChange={(open) => !open && closeDm()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-surface-2 text-xs font-semibold uppercase">
              {dmPeer?.name.charAt(0)}
            </span>
            {dmPeer?.name}
          </SheetTitle>
          <SheetDescription>Mensagens privadas: só vocês dois veem.</SheetDescription>
        </SheetHeader>

        <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
          <ol className="flex flex-col gap-2 p-4" aria-label="Mensagens privadas">
            {loading && <li className="text-sm text-muted-foreground">Carregando…</li>}
            {!loading && messages.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhuma mensagem ainda. Diga oi!</li>
            )}
            {messages.map((m) => {
              const mine = m.fromId === me;
              return (
                <li
                  key={m.id}
                  data-testid="dm"
                  className={cn(
                    'max-w-[85%] rounded-md px-3 py-1.5 text-sm',
                    mine ? 'self-end bg-primary/15' : 'self-start bg-surface-2',
                  )}
                >
                  <MessageText text={m.text} compact />
                  <time className={cn('block font-mono text-[10px] text-subtle', mine && 'text-right')}>
                    {formatTime(m.createdAt)}
                  </time>
                </li>
              );
            })}
          </ol>
        </ScrollArea>

        <form onSubmit={send} className="flex items-end gap-2 border-t p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Mensagem para ${dmPeer?.name ?? ''}…`}
            aria-label="Mensagem privada"
            rows={1}
            maxLength={2000}
            className="max-h-32 min-h-9 resize-none py-2"
          />
          <Button type="submit" size="icon" disabled={!text.trim() || sending} aria-label="Enviar mensagem privada">
            {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
