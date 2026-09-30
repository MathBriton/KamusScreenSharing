import { useCallback, useEffect, useState } from 'react';
import { LogIn, RefreshCw, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { fetchFriends, type OfflineFriend, type OnlineFriend } from '@/api';

const POLL_OPEN_MS = 5_000;
const POLL_CLOSED_MS = 30_000;

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

function lastSeenLabel(ms: number): string {
  const minutes = Math.round((ms - Date.now()) / 60_000);
  if (minutes > -1) return 'agora há pouco';
  if (minutes > -60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}

interface Props {
  currentRoom?: string;
  onJoinRoom: (room: string) => void;
}

/** Quem está online agora (e em qual sala) e quem foi visto recentemente. */
export function FriendsMenu({ currentRoom, onJoinRoom }: Props) {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState<OnlineFriend[]>([]);
  const [recent, setRecent] = useState<OfflineFriend[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchFriends();
      setOnline(data.online);
      setRecent(data.recent);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => clearInterval(id);
  }, [open, load]);

  const liveCount = online.filter((f) => f.live).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="gap-2" aria-label={`Amigos (${online.length} online)`}>
          <Users />
          Amigos
          {online.length > 0 && (
            <Badge variant={liveCount > 0 ? 'destructive' : 'secondary'} className="px-1.5 tabular-nums">
              {online.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="font-medium">Amigos</h2>
          <Button size="icon-sm" variant="ghost" onClick={() => void load()} aria-label="Atualizar">
            <RefreshCw />
          </Button>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-3 px-4 pb-4">
            {error && <p className="text-sm text-destructive">Não foi possível carregar a lista.</p>}

            <section className="grid gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Online agora ({online.length})
              </h3>
              {online.length === 0 && <p className="text-sm text-muted-foreground">Ninguém online no momento.</p>}
              <ul className="grid gap-2" aria-label="Amigos online">
                {online.map((f) => (
                  <li key={f.identity} className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs font-medium">{f.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-sm">
                        {f.name}
                        {f.live && <Badge variant="destructive">ao vivo</Badge>}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">sala {f.room}</span>
                    </div>
                    {f.room === currentRoom ? (
                      <span className="text-xs text-muted-foreground">nesta sala</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpen(false);
                          onJoinRoom(f.room);
                        }}
                      >
                        <LogIn />
                        Entrar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {recent.length > 0 && (
              <>
                <Separator />
                <section className="grid gap-2">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Vistos recentemente
                  </h3>
                  <ul className="grid gap-2" aria-label="Vistos recentemente">
                    {recent.map((f) => (
                      <li key={f.name} className="flex items-center gap-2 opacity-80">
                        <Avatar className="size-8 grayscale">
                          <AvatarFallback className="text-xs">{f.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="grid min-w-0 flex-1">
                          <span className="truncate text-sm">{f.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            visto {lastSeenLabel(f.lastSeen)}
                            {f.lastRoom && ` · sala ${f.lastRoom}`}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
