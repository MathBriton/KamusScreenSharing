import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { Room } from 'livekit-client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Composer } from './Composer';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';
import { collectMedia, formatTime } from './links';
import { ImagesTab, LinksTab } from './MediaTabs';
import { MessageText } from './MessageText';
import { SafeImage } from './SafeImage';
import { useChat } from './useChat';

interface Props {
  room: Room;
  roomName: string;
  token: string | null;
  connected: boolean;
}

type Tab = 'chat' | 'images' | 'links';

export function Chat({ room, roomName, token, connected }: Props) {
  const { items, messages, loaded, send } = useChat(room, roomName, token);
  const { images, links } = useMemo(() => collectMedia(messages), [messages]);
  const [tab, setTab] = useState<Tab>('chat');
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mantém a última mensagem visível (rola o viewport interno do ScrollArea).
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [items, tab]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    if (files.length) {
      setTab('chat');
      setDropped(files);
    }
  };

  const canWrite = connected && !!token;

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
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="images">Imagens{images.length > 0 && ` (${images.length})`}</TabsTrigger>
          <TabsTrigger value="links">Links{links.length > 0 && ` (${links.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex min-h-0 flex-col">
          <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
            <ol className="flex flex-col gap-3 pr-3" aria-label="Mensagens">
              {items.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  {loaded || !token ? 'Nenhuma mensagem ainda.' : 'Carregando histórico…'}
                </li>
              )}
              {items.map((m) =>
                m.kind === 'system' ? (
                  <li key={m.id} className="pl-9 text-xs text-subtle">
                    {m.text} · <time className="font-mono tabular-nums">{formatTime(m.createdAt)}</time>
                  </li>
                ) : (
                  <li key={m.id} className="flex gap-2.5 text-sm">
                    <span
                      className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-[11px] font-semibold uppercase"
                      aria-hidden
                    >
                      {m.author.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <strong className={cn('font-medium', m.isLocal && 'text-primary')}>
                        {m.isLocal ? 'Você' : m.author}
                      </strong>
                      <time className="font-mono text-[11px] text-subtle tabular-nums">{formatTime(m.createdAt)}</time>
                    </div>
                    <MessageText
                      text={m.text}
                      onOpenImage={(url) => setLightbox({ url, caption: `${m.author} · ${formatTime(m.createdAt)}` })}
                    />
                    {m.attachments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.attachments.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setLightbox({ url: a.url, caption: `${m.author} · ${formatTime(m.createdAt)}` })}
                          >
                            <SafeImage
                              fallback={<span className="text-xs text-muted-foreground italic">imagem expirada</span>}
                              src={a.url}
                              alt={`Imagem de ${m.author}`}
                              loading="lazy"
                              className="max-h-48 max-w-full rounded-md border object-contain"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    </div>
                  </li>
                ),
              )}
            </ol>
          </ScrollArea>
          <Composer
            disabled={!canWrite}
            onSend={send}
            droppedFiles={dropped}
            onDroppedConsumed={() => setDropped([])}
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
      </Tabs>

      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
