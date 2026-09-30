import type { ReactNode, RefObject } from 'react';
import type { ParticipantInfo } from '@/participants';
import { StreamCard, StreamThumb } from './StreamCard';
import type { ScreenStream } from './useScreenShares';

export type Layout = 'grid' | 'focus';

interface Props {
  stageRef: RefObject<HTMLElement | null>;
  streams: ScreenStream[];
  participants: ParticipantInfo[];
  layout: Layout;
  selected?: ScreenStream;
  onSelect: (id: string) => void;
  onToggleFocus: (id: string) => void;
  placeholder: ReactNode;
}

/** Colunas da grade: 1×1, 2×1, 2×2, 3×2, 3×3, 4×… */
function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

export function qualityLabel(p: ParticipantInfo | undefined): string | undefined {
  if (!p?.isSharing) return undefined;
  const parts = [p.height ? `${p.height}p` : null, p.fps ? `${p.fps} FPS` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

export function Stage({ stageRef, streams, participants, layout, selected, onSelect, onToggleFocus, placeholder }: Props) {
  const byId = new Map(participants.map((p) => [p.identity, p]));
  const card = (s: ScreenStream) => (
    <StreamCard
      key={s.id}
      stream={s}
      quality={qualityLabel(byId.get(s.id))}
      selected={s === selected}
      focused={layout === 'focus'}
      onSelect={() => onSelect(s.id)}
      onToggleFocus={() => onToggleFocus(s.id)}
    />
  );

  const cols = columnsFor(streams.length);
  const rows = Math.ceil(streams.length / cols);

  return (
    <section
      ref={stageRef}
      aria-label="Transmissões"
      className="flex min-h-0 flex-col gap-2 bg-background p-2 md:flex-1"
    >
      {streams.length === 0 ? (
        <div className="grid min-h-48 flex-1 place-items-center rounded-md border border-dashed text-center">
          {placeholder}
        </div>
      ) : layout === 'focus' && selected ? (
        <>
          <div className="aspect-video md:aspect-auto md:min-h-0 md:flex-1">{card(selected)}</div>
          {streams.length > 1 && (
            <div className="flex h-20 shrink-0 gap-2 overflow-x-auto md:h-24">
              {streams.map((s) => (
                <StreamThumb key={s.id} stream={s} selected={s === selected} onSelect={() => onSelect(s.id)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div
          className="grid gap-2 max-md:grid-cols-1! max-md:grid-rows-none! max-md:[&>*]:aspect-video md:min-h-0 md:flex-1"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {streams.map(card)}
        </div>
      )}
    </section>
  );
}
