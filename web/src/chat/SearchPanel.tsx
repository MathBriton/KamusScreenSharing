import { useEffect, useState } from 'react';
import { ImageIcon, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { chatApi, type ChatMessage, type SearchKind } from '@/api';
import { formatTime } from './links';
import { MessageText } from './MessageText';

const KINDS: { id: SearchKind; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'links', label: 'Links' },
  { id: 'images', label: 'Imagens' },
];

interface Props {
  roomName: string;
  token: string;
  onClose: () => void;
  onJump: (message: ChatMessage) => void;
}

/** Busca no histórico inteiro da sala (não só no que está carregado). */
export function SearchPanel({ roomName, token, onClose, onJump }: Props) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('all');
  const [results, setResults] = useState<ChatMessage[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q && kind === 'all') {
      setResults(null);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const id = setTimeout(() => {
      chatApi
        .search(roomName, token, q, kind)
        .then((r) => !cancelled && setResults(r))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, kind, roomName, token]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" role="search">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Buscar no histórico…"
            aria-label="Buscar no histórico"
            className="pl-8"
          />
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Fechar busca">
          <X />
        </Button>
      </div>
      <div className="flex gap-1" role="group" aria-label="Filtrar resultados">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={cn(
              'rounded-sm border px-2 py-0.5 text-xs',
              kind === k.id ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {k.label}
          </button>
        ))}
        {loading && <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {results === null ? (
          <p className="p-2 text-xs text-muted-foreground">Digite para buscar em mensagens, autores e links.</p>
        ) : results.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">Nada encontrado.</p>
        ) : (
          <ul className="grid gap-1 pr-3" aria-label="Resultados da busca">
            {results.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onJump(m)}
                  className="grid w-full gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                >
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{m.author}</span> ·{' '}
                    <span className="font-mono">{formatTime(m.createdAt)}</span>
                    {m.attachments.length > 0 && (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        · <ImageIcon className="size-3" /> {m.attachments.length}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-3">
                    <MessageText text={m.text} highlight={query.trim()} compact />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
