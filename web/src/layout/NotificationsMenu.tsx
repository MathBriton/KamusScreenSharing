import { useState } from 'react';
import { AtSign, Bell, CheckCheck, MessageSquare, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAccount } from '@/account/AccountContext';
import type { AppNotification } from '@/api';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

const ICONS = { dm: MessageSquare, mention: AtSign, live: Radio } as const;

function describe(n: AppNotification): { title: string; body?: string } {
  if (n.kind === 'dm') return { title: `Mensagem de ${n.data.fromName}`, body: n.data.preview };
  if (n.kind === 'mention') return { title: `${n.data.fromName} mencionou você · sala ${n.data.room}`, body: n.data.preview };
  return { title: `${n.data.fromName} está ao vivo`, body: `sala ${n.data.room}` };
}

export function NotificationsMenu({ onJoinRoom }: { onJoinRoom: (room: string) => void }) {
  const { notifications, unreadNotifications, markRead, markAllRead, openDm } = useAccount();
  const [open, setOpen] = useState(false);
  const [askedPermission, setAskedPermission] = useState(
    () => !('Notification' in window) || Notification.permission !== 'default',
  );

  const act = (n: AppNotification) => {
    setOpen(false);
    void markRead([n.id]);
    if (n.kind === 'dm') openDm({ id: n.data.fromId, name: n.data.fromName });
    else onJoinRoom(n.data.room);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificações${unreadNotifications ? ` (${unreadNotifications} não lidas)` : ''}`}
        >
          <Bell />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="font-medium">Notificações</h2>
          <Button size="sm" variant="ghost" onClick={() => void markAllRead()} disabled={unreadNotifications === 0}>
            <CheckCheck />
            Marcar lidas
          </Button>
        </div>
        {!askedPermission && (
          <button
            type="button"
            className="mx-4 mb-2 w-[calc(100%-2rem)] rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-left text-xs text-primary"
            onClick={async () => {
              await Notification.requestPermission();
              setAskedPermission(true);
            }}
          >
            Receber estes avisos também como notificação do sistema (com a aba em segundo plano)
          </button>
        )}
        <ScrollArea className="max-h-[60vh]">
          {notifications.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Nada por aqui ainda.</p>
          ) : (
            <ul className="grid gap-0.5 px-2 pb-2" aria-label="Notificações">
              {notifications.map((n) => {
                const Icon = ICONS[n.kind];
                const { title, body } = describe(n);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => act(n)}
                      className={cn(
                        'flex w-full gap-2.5 rounded-md px-2 py-2 text-left hover:bg-surface-2',
                        !n.read && 'bg-primary/5',
                      )}
                    >
                      <Icon className={cn('mt-0.5 size-4 shrink-0', n.kind === 'live' ? 'text-live' : 'text-muted-foreground')} />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className={cn('text-sm', !n.read && 'font-medium')}>{title}</span>
                        {body && <span className="line-clamp-2 text-xs text-muted-foreground">{body}</span>}
                        <span className="text-[11px] text-subtle">{timeAgo(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="não lida" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
