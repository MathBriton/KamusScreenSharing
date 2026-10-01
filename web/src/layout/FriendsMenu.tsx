import { useCallback, useEffect, useState } from 'react';
import { LogIn, MessageSquare, RefreshCw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAccount } from '@/account/AccountContext';
import { accountApi, type Friend } from '@/api';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

const POLL_OPEN_MS = 5_000;
const POLL_CLOSED_MS = 30_000;

interface Props {
  currentRoom?: string;
  onJoinRoom: (room: string) => void;
  /** Só o ícone em telas médias (a barra da sala é mais cheia). */
  compact?: boolean;
}

/** Amigos (perfis do servidor): online e onde, mensagens privadas e vistos recentemente. */
export function FriendsMenu({ currentRoom, onJoinRoom, compact = false }: Props) {
  const { session, conversations, unreadDms, openDm } = useAccount();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState(false);
  const token = session?.token;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setFriends(await accountApi.friends(token));
      setError(false);
    } catch {
      setError(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = setInterval(load, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => clearInterval(id);
  }, [open, load]);

  const online = friends.filter((f) => f.online);
  const offline = friends.filter((f) => !f.online);
  const anyLive = online.some((f) => f.rooms.some((r) => r.live));

  const row = (f: Friend) => {
    const unread = conversations.get(f.id)?.unread ?? 0;
    const presence = f.rooms[0];
    const live = f.rooms.find((r) => r.live);
    const where = live ?? presence;
    return (
      <li key={f.id} className={cn('flex items-center gap-2', !f.online && 'opacity-80')}>
        <span className="relative shrink-0">
          <span className="grid size-8 place-items-center rounded-md bg-surface-2 text-xs font-semibold uppercase">
            {f.name.charAt(0)}
          </span>
          <span
            className={cn(
              'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-popover',
              f.online ? 'bg-primary' : 'bg-subtle',
            )}
            aria-hidden
          />
        </span>
        <div className="grid min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-sm">
            {f.name}
            {live && <Badge variant="destructive">ao vivo</Badge>}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {f.online ? `sala ${where.room}` : `visto ${timeAgo(f.lastSeen)}${f.lastRoom ? ` · sala ${f.lastRoom}` : ''}`}
          </span>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          className="relative"
          onClick={() => {
            setOpen(false);
            openDm({ id: f.id, name: f.name });
          }}
          aria-label={`Mensagem para ${f.name}${unread ? ` (${unread} não lidas)` : ''}`}
          title="Mensagem privada"
        >
          <MessageSquare />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread}
            </span>
          )}
        </Button>
        {f.online &&
          (where.room === currentRoom ? (
            <span className="w-14 text-center text-[11px] text-muted-foreground">aqui</span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-14"
              onClick={() => {
                setOpen(false);
                onJoinRoom(where.room);
              }}
              aria-label={`Entrar na sala de ${f.name}`}
            >
              <LogIn />
            </Button>
          ))}
      </li>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative gap-2 px-2.5" aria-label={`Amigos (${online.length} online)`}>
          <Users />
          <span className={compact ? 'hidden 2xl:inline' : 'max-md:hidden'}>Amigos</span>
          {online.length > 0 && (
            <Badge variant={anyLive ? 'destructive' : 'secondary'} className="px-1.5 tabular-nums">
              {online.length}
            </Badge>
          )}
          {unreadDms > 0 && (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" aria-label="Mensagens não lidas" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] p-0">
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
                {online.map(row)}
              </ul>
            </section>
            {offline.length > 0 && (
              <>
                <Separator />
                <section className="grid gap-2">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Offline</h3>
                  <ul className="grid gap-2" aria-label="Amigos offline">
                    {offline.map(row)}
                  </ul>
                </section>
              </>
            )}
            {friends.length === 0 && !error && (
              <p className="text-sm text-muted-foreground">Quando seus amigos criarem um perfil, eles aparecem aqui.</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
