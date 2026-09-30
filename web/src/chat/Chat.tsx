import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { Room } from 'livekit-client';
import { Bell, BellOff, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/api';
import { Composer } from './Composer';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';
import { collectMedia, formatTime } from './links';
import { ImagesTab, LinksTab } from './MediaTabs';
import { mentionPattern } from './mentions';
import { MessageItem } from './MessageItem';
import { PinnedBar } from './PinnedBar';
import { SearchPanel } from './SearchPanel';
import { useChat } from './useChat';
import { typingLabel, useTyping } from './useTyping';

interface Props {
  room: Room;
  roomName: string;
  token: string | null;
  connected: boolean;
  /** Nomes de quem está na sala (para menções). */
  participantNames: string[];
}

type Tab = 'chat' | 'images' | 'links';

const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

export function Chat({ room, roomName, token, connected, participantNames }: Props) {
  const [tab, setTab] = useState<Tab>('chat');
  const [searching, setSearching] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [notifyPermission, setNotifyPermission] = useState(notificationsSupported ? Notification.permission : 'denied');
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const { typingNames, notifyTyping, stopTyping, clearTyping } = useTyping(room);

  const viewport = () => scrollRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null;

  const jumpTo = useCallback((id: string) => {
    setSearching(false);
    setTab('chat');
    // Espera a aba renderizar antes de rolar.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(`msg-${id}`);
        if (!el) {
          toast('Essa mensagem é antiga e não está no histórico carregado.');
          return;
        }
        stickToBottom.current = false;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setFlashId(id);
        setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1600);
      }),
    );
  }, []);

  const onMention = useCallback(
    (m: ChatMessage) => {
      toast(`${m.author} mencionou você`, {
        description: m.text.slice(0, 120),
        action: { label: 'Ver', onClick: () => jumpTo(m.id) },
      });
      if (document.hidden && notificationsSupported && Notification.permission === 'granted') {
        new Notification(`${m.author} mencionou você`, { body: m.text.slice(0, 140), tag: `kamus-${m.id}` });
      }
    },
    [jumpTo],
  );

  const { items, messages, pins, loaded, send, setPinned } = useChat(room, roomName, token, {
    onMention,
    onRemoteMessage: (m) => clearTyping(m.identity),
  });
  const { images, links } = useMemo(() => collectMedia(messages), [messages]);

  // Menções reconhecidas: quem está na sala + quem já escreveu.
  const knownNames = useMemo(
    () => [...new Set([...participantNames, ...messages.map((m) => m.author)])],
    [participantNames, messages],
  );
  const pattern = useMemo(() => mentionPattern(knownNames), [knownNames]);
  const myName = room.localParticipant.name ?? '';
  const suggestionNames = useMemo(() => knownNames.filter((n) => n !== myName), [knownNames, myName]);

  // Acompanha a última mensagem só se a pessoa já estava no fim da conversa.
  useEffect(() => {
    const el = viewport();
    if (!el) return;
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [tab, searching]);

  useEffect(() => {
    const el = viewport();
    const last = items[items.length - 1];
    if (el && (stickToBottom.current || (last?.kind === 'message' && last.isLocal))) el.scrollTop = el.scrollHeight;
  }, [items, tab, searching]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    if (files.length) {
      setSearching(false);
      setTab('chat');
      setDropped(files);
    }
  };

  const toggleNotifications = async () => {
    if (!notificationsSupported) return;
    if (Notification.permission === 'default') setNotifyPermission(await Notification.requestPermission());
    else toast('As notificações são controladas nas permissões do navegador para este site.');
  };

  const canWrite = connected && !!token;
  const typing = typingLabel(typingNames);

  return (
    <section
      className={cn(
        'relative flex min-h-96 flex-1 flex-col px-4 pt-2 pb-3 md:min-h-0',
        dragging && 'outline-2 -outline-offset-4 outline-primary outline-dashed',
      )}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
      onDrop={onDrop}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="min-h-0 flex-1">
        <div className="flex items-center gap-1 border-b">
          <TabsList variant="line" className="flex-1 justify-start">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="images">Imagens{images.length > 0 && ` (${images.length})`}</TabsTrigger>
            <TabsTrigger value="links">Links{links.length > 0 && ` (${links.length})`}</TabsTrigger>
          </TabsList>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setSearching((s) => !s)}
            disabled={!token}
            aria-label="Buscar no histórico"
            aria-pressed={searching}
            className={cn(searching && 'text-primary')}
          >
            <Search />
          </Button>
          {notificationsSupported && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={toggleNotifications}
              aria-label={notifyPermission === 'granted' ? 'Avisos de menção ativados' : 'Ativar avisos de menção'}
              title={
                notifyPermission === 'granted'
                  ? 'Você recebe uma notificação quando for mencionado com a aba em segundo plano'
                  : 'Receber notificação quando alguém mencionar você'
              }
              className={cn(notifyPermission === 'granted' && 'text-primary')}
            >
              {notifyPermission === 'denied' ? <BellOff /> : <Bell />}
            </Button>
          )}
        </div>

        {searching && token ? (
          <SearchPanel roomName={roomName} token={token} onClose={() => setSearching(false)} onJump={(m) => jumpTo(m.id)} />
        ) : (
          <>
            <TabsContent value="chat" className="flex min-h-0 flex-col">
              <PinnedBar pins={pins} onJump={(m) => jumpTo(m.id)} onUnpin={(id) => void setPinned(id, false)} />
              <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
                <ol className="flex flex-col gap-1.5 pt-2 pr-3" aria-label="Mensagens">
                  {items.length === 0 && (
                    <li className="text-sm text-muted-foreground">
                      {loaded || !token ? 'Nenhuma mensagem ainda.' : 'Carregando histórico…'}
                    </li>
                  )}
                  {items.map((m) =>
                    m.kind === 'system' ? (
                      <li key={m.id} className="pl-10 text-xs text-subtle">
                        {m.text} · <time className="font-mono tabular-nums">{formatTime(m.createdAt)}</time>
                      </li>
                    ) : (
                      <MessageItem
                        key={m.id}
                        item={m}
                        mentionPattern={pattern}
                        flash={flashId === m.id}
                        onReply={() => setReplyTo(m)}
                        onTogglePin={() => void setPinned(m.id, !m.pinned)}
                        onJump={jumpTo}
                        onOpenImage={(url, caption) => setLightbox({ url, caption })}
                      />
                    ),
                  )}
                </ol>
              </ScrollArea>
              <p className="h-4 pt-1 text-[11px] text-muted-foreground" aria-live="polite">
                {typing}
              </p>
              <Composer
                disabled={!canWrite}
                onSend={send}
                droppedFiles={dropped}
                onDroppedConsumed={() => setDropped([])}
                names={suggestionNames}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                onTyping={notifyTyping}
                onStopTyping={stopTyping}
              />
            </TabsContent>

            <TabsContent value="images" className="flex min-h-0 flex-col">
              <ImagesTab
                images={images}
                onOpen={(img) => setLightbox({ url: img.url, caption: `${img.author} · ${formatTime(img.createdAt)}` })}
              />
            </TabsContent>

            <TabsContent value="links" className="flex min-h-0 flex-col">
              <LinksTab links={links} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
