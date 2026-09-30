import { useEffect, useRef } from 'react';
import { PictureInPicture2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isTypingTarget, pipSupported, togglePictureInPicture } from './media';
import type { ScreenStream } from './useScreenShares';
import { useZoom } from './useZoom';

interface Props {
  stream: ScreenStream;
  /** Recebe os atalhos de teclado (P, +, -, 0). */
  primary?: boolean;
  /** Miniatura: sem controles, clique seleciona. */
  compact?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onDoubleClick?: () => void;
}

const overlayButton = 'bg-black/60 text-white hover:bg-black/80 hover:text-white';

export function VideoTile({ stream, primary, compact, selected, onSelect, onDoubleClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const zoom = useZoom(containerRef);

  useEffect(() => {
    const video = videoRef.current!;
    stream.track.attach(video);
    return () => {
      stream.track.detach(video);
    };
  }, [stream.track]);

  useEffect(() => {
    if (!primary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === 'p' || e.key === 'P') void togglePictureInPicture(videoRef.current);
      else if (e.key === '+' || e.key === '=') zoom.zoomIn();
      else if (e.key === '-') zoom.zoomOut();
      else if (e.key === '0') zoom.reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [primary, zoom]);

  const label = stream.isLocal ? `${stream.name} (sua tela)` : stream.name;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'relative h-full overflow-hidden rounded-md border-2 bg-black',
          selected ? 'border-primary' : 'border-transparent hover:border-white/40',
        )}
        aria-label={`Ver transmissão de ${label}`}
      >
        <video ref={videoRef} autoPlay playsInline muted className="size-full object-contain" />
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-left text-xs text-white">
          {label}
        </span>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('group/tile relative size-full touch-none overflow-hidden bg-black', zoom.scale > 1 && 'cursor-grab active:cursor-grabbing')}
      onDoubleClick={onDoubleClick}
      data-testid={`tile-${stream.name}`}
      {...zoom.handlers}
    >
      <div className="size-full" style={zoom.transform}>
        <video ref={videoRef} autoPlay playsInline muted className="size-full object-contain" />
      </div>

      <span className="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
        <span className="size-2 rounded-full bg-red-500" aria-hidden />
        {label}
      </span>

      <div
        className="absolute right-2 bottom-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Button size="icon-sm" variant="ghost" className={overlayButton} onClick={zoom.zoomOut} disabled={zoom.scale <= 1} aria-label="Diminuir zoom">
          <ZoomOut />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={cn(overlayButton, 'w-14 tabular-nums')} onClick={zoom.reset} aria-label="Zoom atual (clique para voltar a 100%)">
              {Math.round(zoom.scale * 100)}%
            </Button>
          </TooltipTrigger>
          <TooltipContent>Roda do mouse ou pinça para ampliar · 0 volta a 100%</TooltipContent>
        </Tooltip>
        <Button size="icon-sm" variant="ghost" className={overlayButton} onClick={zoom.zoomIn} aria-label="Aumentar zoom">
          <ZoomIn />
        </Button>
        {pipSupported && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className={overlayButton}
                onClick={() => void togglePictureInPicture(videoRef.current)}
                aria-label="Picture-in-picture"
              >
                <PictureInPicture2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Janela flutuante{primary ? ' (P)' : ''}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
