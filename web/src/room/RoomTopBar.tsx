import { useState } from 'react';
import { ConnectionQuality } from 'livekit-client';
import { Check, Copy, Loader2, MonitorPlay, Signal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FriendsMenu } from '@/layout/FriendsMenu';
import { NotificationsMenu } from '@/layout/NotificationsMenu';
import { ProfileMenu } from '@/layout/ProfileMenu';
import { RoomsMenu } from '@/layout/RoomsMenu';
import { cn } from '@/lib/utils';
import { formatBitrate, type StreamStats } from './useMetrics';

export const CONNECTION_LABELS: Record<ConnectionQuality, string> = {
  [ConnectionQuality.Excellent]: 'Excelente',
  [ConnectionQuality.Good]: 'Boa',
  [ConnectionQuality.Poor]: 'Instável',
  [ConnectionQuality.Lost]: 'Perdida',
  [ConnectionQuality.Unknown]: '—',
};

export function connectionColor(q: ConnectionQuality): string {
  if (q === ConnectionQuality.Excellent || q === ConnectionQuality.Good) return 'text-primary';
  if (q === ConnectionQuality.Poor) return 'text-warning';
  return 'text-subtle';
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('grid gap-0.5 px-3', className)}>
      <span className="font-mono text-[13px] leading-none whitespace-nowrap text-foreground tabular-nums">{value}</span>
      <span className="text-[11px] leading-none text-muted-foreground">{label}</span>
    </div>
  );
}

interface Props {
  /** Texto do estado da conexão quando não está conectado (ex.: "Reconectando…"). */
  connectionStatus?: string;
  roomName: string;
  count: number;
  live: boolean;
  elapsed: string | null;
  ping: number | null;
  connection: ConnectionQuality;
  stats: StreamStats | null;
  statsOwner?: string;
  onHome: () => void;
  onJoinRoom: (room: string) => void;
  onLeave: () => void;
}

export function RoomTopBar({
  connectionStatus,
  roomName,
  count,
  live,
  elapsed,
  ping,
  connection,
  stats,
  statsOwner,
  onHome,
  onJoinRoom,
  onLeave,
}: Props) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/s/${encodeURIComponent(roomName)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      toast.error('Não foi possível copiar', { description: link });
      return;
    }
    toast.success('Link copiado!', { description: 'Envie para quem vai assistir.' });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-3 md:gap-4 md:px-4">
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onHome();
        }}
        className="flex items-center gap-2 font-semibold tracking-tight"
        aria-label="Kamus: início"
      >
        <MonitorPlay className="size-5 text-primary" />
        <span className="hidden text-sm uppercase lg:inline">Kamus</span>
      </a>

      <div className="h-6 w-px bg-border max-sm:hidden" />

      <div className="grid min-w-20 gap-0.5">
        <h1 className="truncate text-sm leading-none font-semibold">Sala {roomName}</h1>
        <span className="text-[11px] leading-none text-muted-foreground">
          {count === 1 ? '1 na sala' : `${count} na sala`}
        </span>
      </div>

      <nav className="flex shrink-0 items-center" aria-label="Menu principal">
        <RoomsMenu currentRoom={roomName} onJoinRoom={onJoinRoom} compact />
        <FriendsMenu currentRoom={roomName} onJoinRoom={onJoinRoom} compact />
      </nav>

      <div
        className={cn(
          'flex h-9 shrink-0 items-center gap-2 rounded-md border px-2.5 font-mono text-xs tabular-nums',
          live ? 'border-live/40' : 'border-border',
        )}
        aria-label={live ? 'Sala ao vivo' : 'Ninguém transmitindo'}
      >
        {live ? (
          <span className="flex items-center gap-1.5 font-sans font-bold text-live">
            <span className="size-2 animate-pulse rounded-full bg-live" aria-hidden />
            LIVE
          </span>
        ) : (
          <span className="font-sans font-medium text-subtle">OFFLINE</span>
        )}
        {elapsed && (
          <span className="text-muted-foreground max-sm:hidden" title="Duração da sessão">
            {elapsed}
          </span>
        )}
      </div>

      {connectionStatus && (
        <span className="flex h-9 items-center gap-1.5 rounded-md border border-warning/40 px-2.5 text-xs text-warning" role="status">
          <Loader2 className="size-3.5 animate-spin" />
          {connectionStatus}
        </span>
      )}

      <div className="flex h-9 shrink-0 items-center gap-2 rounded-md border pr-1 pl-2.5 max-xl:hidden">
        <div className="grid gap-0.5">
          <span className="text-[10px] leading-none text-muted-foreground uppercase">Código</span>
          <span className="max-w-36 truncate font-mono text-xs leading-none">{roomName}</span>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={copy} aria-label="Copiar link">
          {copied ? <Check className="text-primary" /> : <Copy />}
        </Button>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="ml-auto flex shrink-0 items-center divide-x divide-border max-xl:hidden" data-testid="metrics">
            <div className="flex items-center gap-2 pr-3">
              <Signal className={cn('size-4', connectionColor(connection))} aria-hidden />
              <Metric label="Ping" value={ping !== null ? `${ping} ms` : '—'} className="px-0" />
            </div>
            <Metric label="Conexão" value={CONNECTION_LABELS[connection]} />
            <Metric label="Resolução" value={stats?.height ? `${stats.height}p` : '—'} />
            <Metric label="FPS" value={stats?.fps !== undefined ? String(stats.fps) : '—'} />
            <Metric label="Bitrate" value={formatBitrate(stats?.bitrate)} className="pr-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {statsOwner ? `Resolução, FPS e bitrate da transmissão de ${statsOwner}` : 'Nenhuma transmissão selecionada'}
        </TooltipContent>
      </Tooltip>

      <Button size="icon-sm" variant="ghost" onClick={copy} aria-label="Copiar link" className="ml-auto xl:hidden">
        {copied ? <Check className="text-primary" /> : <Copy />}
      </Button>

      <div className="flex shrink-0 items-center gap-1 xl:ml-2 xl:border-l xl:pl-2">
        <NotificationsMenu onJoinRoom={onJoinRoom} />
        <ProfileMenu onLeaveRoom={onLeave} />
      </div>
    </header>
  );
}
