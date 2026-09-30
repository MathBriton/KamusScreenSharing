import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ParticipantInfo } from './participants';

export function ParticipantList({ participants }: { participants: ParticipantInfo[] }) {
  return (
    <section className="p-4">
      <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Na sala ({participants.length})
      </h3>
      <ul className="grid max-h-[30vh] gap-2 overflow-y-auto" aria-label="Participantes">
        {participants.map((p) => (
          <li key={p.identity} className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs font-medium">{p.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.name}
              {p.isLocal && <span className="text-muted-foreground"> (você)</span>}
            </span>
            {p.role === 'presenter' &&
              (p.isSharing ? (
                <Badge variant="destructive">ao vivo</Badge>
              ) : (
                <Badge variant="secondary">apresentador</Badge>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
