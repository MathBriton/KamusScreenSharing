import { useEffect, useRef, type ReactNode } from 'react';
import { Maximize2, MicOff, MonitorUp, MoreVertical, PictureInPicture2, RotateCcw, Rows2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isTypingTarget, pipSupported, togglePictureInPicture } from './media';
import type { ScreenStream } from './useScreenShares';
import { useZoom } from './useZoom';

export function Initial({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-sm bg-surface-2 text-[11px] font-semibold text-foreground uppercase',
        className,
      )}
      aria-hidden
    >
      {name.trim().charAt(0) || '?'}
    </span>
  );
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span className={cn('rounded-sm bg-live px-1.5 py-0.5 text-[11px] leading-none font-bold tracking-wide text-white', className)}>
      LIVE
    </span>
  );
}

/** Rótulo sobre o vídeo: fundo sólido escuro, sem blur nem gradiente. */
function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('flex h-7 items-center gap-1.5 rounded-sm bg-black/75 px-2 text-xs', className)}>{children}</span>;
}

interface Props {
  stream: ScreenStream;
  /** Ex.: "1080p · 60 FPS" */
  quality?: string;
  selected: boolean;
  focused: boolean;
  onSelect: () => void;
  onToggleFocus: () => void;
}

const overlayButton = 'size-7 rounded-sm bg-black/75 text-white hover:bg-black hover:text-white';

export function StreamCard({ stream, quality, selected, focused, onSelect, onToggleFocus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const zoom = useZoom(containerRef);
  const label = stream.isLocal ? `${stream.name} (você)` : stream.name;

  useEffect(() => {
    const video = videoRef.current!;
    stream.track.attach(video);
    return () => {
      stream.track.detach(video);
    };
  }, [stream.track]);

  // Atalhos da transmissão selecionada: P (janela flutuante), + - 0 (zoom).
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === 'p' || e.key === 'P') void togglePictureInPicture(videoRef.current);
      else if (e.key === '+' || e.key === '=') zoom.zoomIn();
      else if (e.key === '-') zoom.zoomOut();
      else if (e.key === '0') zoom.reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, zoom]);

  return (
    <div
      className={cn(
        'group/tile relative size-full overflow-hidden rounded-md border bg-black transition-colors',
        selected ? 'border-primary' : 'border-border hover:border-input',
      )}
      data-testid={`tile-${stream.name}`}
      data-selected={selected}
      onClick={onSelect}
      onDoubleClick={onToggleFocus}
    >
      <div
        ref={containerRef}
        className={cn('size-full touch-none', zoom.scale > 1 && 'cursor-grab active:cursor-grabbing')}
        {...zoom.handlers}
      >
        <div className="size-full" style={zoom.transform}>
          <video ref={videoRef} autoPlay playsInline muted className="size-full object-contain" />
        </div>
      </div>

      {/* Cabeçalho: quem, LIVE, estado, microfone e menu. */}
      <div
        className="absolute inset-x-2 top-2 flex items-center gap-1.5"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Chip className="pl-1 font-medium text-white">
          <Initial name={stream.name} className="size-5" />
          <span className="max-w-40 truncate">{label}</span>
        </Chip>
        <LiveBadge />
        <Chip className="hidden border border-primary/40 text-primary sm:flex">
          <MonitorUp className="size-3.5" />
          Transmitindo
        </Chip>
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(overlayButton, 'grid place-items-center text-subtle')} aria-label="Microfone desligado">
                <MicOff className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Sem microfone: a voz fica no Discord</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" className={overlayButton} aria-label={`Opções da transmissão de ${stream.name}`}>
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={onToggleFocus}>
                {focused ? <Rows2 /> : <Maximize2 />}
                {focused ? 'Voltar para a grade' : 'Ver em foco'}
              </DropdownMenuItem>
              {pipSupported && (
                <DropdownMenuItem onSelect={() => void togglePictureInPicture(videoRef.current)}>
                  <PictureInPicture2 />
                  Janela flutuante
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={zoom.zoomIn}>
                <ZoomIn />
                Aumentar zoom
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={zoom.reset} disabled={zoom.scale <= 1}>
                <RotateCcw />
                Zoom 100%
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {quality && (
        <Chip className="pointer-events-none absolute bottom-2 left-2 h-6 font-mono text-[11px] text-muted-foreground tabular-nums">
          {quality}
        </Chip>
      )}

      {/* Zoom: aparece ao passar o mouse (sempre visível em telas de toque). */}
      <div
        className="absolute right-2 bottom-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Button size="icon-sm" variant="ghost" className={overlayButton} onClick={zoom.zoomOut} disabled={zoom.scale <= 1} aria-label="Diminuir zoom">
          <ZoomOut />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={cn(overlayButton, 'w-auto px-2 font-mono text-[11px] tabular-nums')}
          onClick={zoom.reset}
          aria-label="Zoom atual (clique para voltar a 100%)"
          title="Roda do mouse ou pinça para ampliar · 0 volta a 100%"
        >
          {Math.round(zoom.scale * 100)}%
        </Button>
        <Button size="icon-sm" variant="ghost" className={overlayButton} onClick={zoom.zoomIn} aria-label="Aumentar zoom">
          <ZoomIn />
        </Button>
        {pipSupported && (
          <Button
            size="icon-sm"
            variant="ghost"
            className={overlayButton}
            onClick={() => void togglePictureInPicture(videoRef.current)}
            aria-label="Picture-in-picture"
          >
            <PictureInPicture2 />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Miniatura no modo Foco: clique para trocar a transmissão em destaque. */
export function StreamThumb({ stream, selected, onSelect }: { stream: ScreenStream; selected: boolean; onSelect: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current!;
    stream.track.attach(video);
    return () => {
      stream.track.detach(video);
    };
  }, [stream.track]);
  const label = stream.isLocal ? `${stream.name} (você)` : stream.name;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative aspect-video h-full shrink-0 overflow-hidden rounded-md border bg-black',
        selected ? 'border-primary' : 'border-border hover:border-input',
      )}
      aria-label={`Ver transmissão de ${label}`}
    >
      <video ref={videoRef} autoPlay playsInline muted className="size-full object-contain" />
      <span className="absolute inset-x-1 bottom-1 flex items-center gap-1">
        <LiveBadge className="px-1 text-[9px]" />
        <span className="truncate rounded-sm bg-black/75 px-1 text-[11px] text-white">{label}</span>
      </span>
    </button>
  );
}
