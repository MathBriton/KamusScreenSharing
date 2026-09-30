import { MicOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ParticipantInfo } from '@/participants';
import { qualityLabel } from '@/stage/Stage';
import { CONNECTION_LABELS, connectionColor } from './RoomTopBar';

export function ParticipantsPanel({ participants }: { participants: ParticipantInfo[] }) {
  const sharing = participants.filter((p) => p.isSharing).length;
  return (
    <section className="flex max-h-[40%] shrink-0 flex-col border-b">
      <h2 className="flex items-center justify-between px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground">
        <span>Participantes · {participants.length}</span>
        <span className="font-mono tabular-nums">{sharing} transmitindo</span>
      </h2>
      <ul className="grid gap-0.5 overflow-y-auto px-2 pb-2" aria-label="Participantes">
        {participants.map((p) => {
          const detail = qualityLabel(p);
          return (
            <li key={p.identity} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="relative shrink-0">
                    <span className="grid size-8 place-items-center rounded-md bg-surface-2 text-xs font-semibold uppercase">
                      {p.name.charAt(0)}
                    </span>
                    <span
                      className={cn(
                        'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-current',
                        connectionColor(p.connection),
                      )}
                      aria-label={`Conexão: ${CONNECTION_LABELS[p.connection]}`}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Conexão: {CONNECTION_LABELS[p.connection]}</TooltipContent>
              </Tooltip>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex items-center gap-1.5 text-sm leading-tight">
                  <span className="truncate">{p.name}</span>
                  {p.isLocal && (
                    <span className="rounded-sm bg-surface-2 px-1 text-[10px] text-muted-foreground">você</span>
                  )}
                  <MicOff className="size-3 shrink-0 text-subtle" aria-label="Microfone desligado" />
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {p.isSharing ? (
                    <>
                      Transmitindo{detail && <span className="font-mono tabular-nums"> · {detail}</span>}
                    </>
                  ) : (
                    'Não transmitindo'
                  )}
                </span>
              </div>
              <span
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px]',
                  p.isSharing ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-subtle',
                )}
              >
                <span className={cn('size-1.5 rounded-full', p.isSharing ? 'bg-primary' : 'bg-subtle')} aria-hidden />
                {p.isSharing ? 'ao vivo' : 'parado'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
