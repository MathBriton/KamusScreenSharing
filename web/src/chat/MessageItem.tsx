import { CornerUpLeft, ImageIcon, Pin, PinOff, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReplyPreview } from '@/api';
import { formatTime } from './links';
import { MessageText } from './MessageText';
import { SafeImage } from './SafeImage';
import type { ChatItem } from './useChat';

type MessageChatItem = Extract<ChatItem, { kind: 'message' }>;

export function ReplyQuote({ reply, onJump }: { reply: ReplyPreview; onJump?: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onJump?.(reply.id)}
      className="mb-1 flex w-full min-w-0 items-center gap-1.5 border-l-2 border-primary/50 pl-2 text-left text-xs text-muted-foreground hover:text-foreground"
      aria-label={`Ver mensagem de ${reply.author}`}
    >
      <CornerUpLeft className="size-3 shrink-0" />
      <span className="shrink-0 font-medium">{reply.author}</span>
      <span className="truncate">{reply.text || (reply.hasImage ? 'imagem' : '')}</span>
      {reply.hasImage && <ImageIcon className="size-3 shrink-0" />}
    </button>
  );
}

interface Props {
  item: MessageChatItem;
  mentionPattern: RegExp | null;
  flash: boolean;
  onReply: () => void;
  onTogglePin: () => void;
  onJump: (id: string) => void;
  onOpenImage: (url: string, caption: string) => void;
}

export function MessageItem({ item: m, mentionPattern, flash, onReply, onTogglePin, onJump, onOpenImage }: Props) {
  const caption = `${m.author} · ${formatTime(m.createdAt)}`;
  return (
    <li
      id={`msg-${m.id}`}
      data-testid="message"
      data-mention={m.mentionsMe || undefined}
      className={cn(
        'group/msg relative flex gap-2.5 rounded-md px-1.5 py-1 text-sm transition-colors',
        m.mentionsMe && 'border-l-2 border-primary bg-primary/5',
        flash && 'bg-primary/10 ring-1 ring-primary/40',
      )}
    >
      <span
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-[11px] font-semibold uppercase"
        aria-hidden
      >
        {m.author.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <strong className={cn('font-medium', m.isLocal && 'text-primary')}>{m.isLocal ? 'Você' : m.author}</strong>
          <time className="font-mono text-[11px] text-subtle tabular-nums">{formatTime(m.createdAt)}</time>
          {m.pinned && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground" title={`Fixada por ${m.pinned.by}`}>
              <Pin className="size-3" />
              fixada
            </span>
          )}
        </div>
        {m.replyTo && <ReplyQuote reply={m.replyTo} onJump={onJump} />}
        <MessageText text={m.text} mentionPattern={mentionPattern} onOpenImage={(url) => onOpenImage(url, caption)} />
        {m.attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {m.attachments.map((a) => (
              <button key={a.id} type="button" onClick={() => onOpenImage(a.url, caption)}>
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

      {/* Ações: aparecem ao passar o mouse ou com foco do teclado. */}
      <div className="absolute -top-2 right-1 flex gap-0.5 rounded-md border bg-card p-0.5 opacity-0 shadow-sm transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100 [@media(hover:none)]:hidden">
        <Button size="icon-xs" variant="ghost" onClick={onReply} aria-label={`Responder ${m.author}`} title="Responder">
          <Reply />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onTogglePin}
          aria-label={m.pinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
          title={m.pinned ? 'Desafixar' : 'Fixar no topo'}
        >
          {m.pinned ? <PinOff /> : <Pin />}
        </Button>
      </div>
    </li>
  );
}
