import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DoorOpen, History, LayoutGrid, Plus, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAccount } from '@/account/AccountContext';
import { accountApi, type ActiveRoom } from '@/api';
import { isValidRoomName, loadRecentRooms, normalizeRoomName, randomRoomId } from '@/rooms';

interface Props {
  currentRoom?: string;
  onJoinRoom: (room: string) => void;
  /** Só o ícone em telas médias (a barra da sala é mais cheia). */
  compact?: boolean;
}

/** Salas ativas agora, recentes e atalho para criar/entrar. */
export function RoomsMenu({ currentRoom, onJoinRoom, compact = false }: Props) {
  const { session } = useAccount();
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const token = session?.token;

  const load = useCallback(async () => {
    if (!token) return;
    setRooms(await accountApi.activeRooms(token).catch(() => []));
    setRecent(loadRecentRooms());
  }, [token]);

  useEffect(() => {
    if (!open) return;
    void load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [open, load]);

  const go = (room: string) => {
    setOpen(false);
    setTarget('');
    onJoinRoom(room);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = normalizeRoomName(target);
    go(target.trim() ? name : randomRoomId());
  };

  const liveRooms = rooms.filter((r) => r.people.some((p) => p.live)).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2.5" aria-label="Salas">
          <LayoutGrid />
          <span className={compact ? 'hidden 2xl:inline' : 'max-md:hidden'}>Salas</span>
          {liveRooms > 0 && <Badge variant="destructive" className="px-1.5 tabular-nums">{liveRooms}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="font-medium">Salas</h2>
          <Button size="icon-sm" variant="ghost" onClick={() => void load()} aria-label="Atualizar salas">
            <RefreshCw />
          </Button>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-3 px-4 pb-4">
            <form className="flex gap-2" onSubmit={submit}>
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Nome ou código"
                aria-label="Sala para entrar ou criar"
                className="h-8"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!!target.trim() && !isValidRoomName(normalizeRoomName(target))}
                aria-label={target.trim() ? 'Entrar na sala digitada' : 'Criar sala nova'}
              >
                {target.trim() ? <DoorOpen /> : <Plus />}
                {target.trim() ? 'Entrar' : 'Criar'}
              </Button>
            </form>

            <section className="grid gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Ativas agora ({rooms.length})
              </h3>
              {rooms.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sala com gente agora.</p>}
              <ul className="grid gap-1.5" aria-label="Salas ativas">
                {rooms.map((r) => {
                  const live = r.people.filter((p) => p.live);
                  return (
                    <li key={r.room} className="flex items-center gap-2 rounded-md border px-2.5 py-2">
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <span className="flex min-w-0 items-center gap-1.5 font-mono text-sm">
                          <span className="truncate">{r.room}</span>
                          {live.length > 0 && (
                            <Badge variant="destructive" className="shrink-0">
                              ao vivo
                            </Badge>
                          )}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {r.people.map((p) => p.name).join(', ')}
                        </span>
                      </div>
                      {r.room === currentRoom ? (
                        <span className="shrink-0 text-xs text-muted-foreground">aqui</span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => go(r.room)}>
                          Entrar
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {recent.length > 0 && (
              <>
                <Separator />
                <section className="grid gap-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    <History className="size-3.5" />
                    Recentes
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((r) => (
                      <Button
                        key={r}
                        size="sm"
                        variant="ghost"
                        className="border font-mono text-xs"
                        disabled={r === currentRoom}
                        onClick={() => go(r)}
                      >
                        {r}
                      </Button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
