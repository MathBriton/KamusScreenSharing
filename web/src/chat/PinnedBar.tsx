import { useState } from 'react';
import { ChevronDown, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/api';
import { formatTime } from './links';

interface Props {
  pins: ChatMessage[];
  onJump: (message: ChatMessage) => void;
  onUnpin: (id: string) => void;
}

const snippet = (m: ChatMessage) => m.text || (m.attachments.length ? 'imagem' : '');

/** Mensagens fixadas no topo do chat (a mais recente sempre visível). */
export function PinnedBar({ pins, onJump, onUnpin }: Props) {
  const [open, setOpen] = useState(false);
  if (pins.length === 0) return null;
  const latest = pins[0];

  return (
    <section className="mb-2 rounded-md border bg-surface-2/50 text-xs" aria-label="Mensagens fixadas">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
        aria-expanded={open}
      >
        <Pin className="size-3.5 shrink-0 text-primary" />
        <span className="shrink-0 font-medium">Fixadas ({pins.length})</span>
        {!open && (
          <span className="truncate text-muted-foreground">
            {latest.author}: {snippet(latest)}
          </span>
        )}
        <ChevronDown className={cn('ml-auto size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="grid max-h-48 gap-0.5 overflow-y-auto border-t p-1">
          {pins.map((m) => (
            <li key={m.id} className="flex items-start gap-1 rounded-sm hover:bg-surface-2">
              <button type="button" onClick={() => onJump(m)} className="grid min-w-0 flex-1 gap-0.5 px-1.5 py-1 text-left">
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{m.author}</span> ·{' '}
                  <span className="font-mono">{formatTime(m.createdAt)}</span> · fixada por {m.pinned?.by}
                </span>
                <span className="line-clamp-2 break-words">{snippet(m)}</span>
              </button>
              <Button size="icon-xs" variant="ghost" onClick={() => onUnpin(m.id)} aria-label="Desafixar mensagem" title="Desafixar">
                <PinOff />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
