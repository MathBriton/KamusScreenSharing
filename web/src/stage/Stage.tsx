import { useEffect, useRef, useState } from 'react';
import { Columns2, Maximize, Minimize, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isTypingTarget, toggleFullscreen } from './media';
import type { ScreenStream } from './useScreenShares';
import { VideoTile } from './VideoTile';

type Layout = 'focus' | 'grid';

interface Props {
  streams: ScreenStream[];
  placeholder: string;
}

/** Prefere assistir a tela de outra pessoa em vez da própria prévia. */
function pickDefault(streams: ScreenStream[]): string | undefined {
  return (streams.find((s) => !s.isLocal) ?? streams[0])?.id;
}

export function Stage({ streams, placeholder }: Props) {
  const stageRef = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<Layout>('focus');
  const [selectedId, setSelectedId] = useState<string>();
  const [fullscreen, setFullscreen] = useState(false);

  const selected = streams.find((s) => s.id === selectedId) ?? streams.find((s) => s.id === pickDefault(streams));
  const others = streams.filter((s) => s !== selected);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if ((e.key === 'f' || e.key === 'F') && streams.length > 0) toggleFullscreen(stageRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [streams.length]);

  // A janela flutuante não faz sentido sem transmissão.
  useEffect(() => {
    if (streams.length === 0 && document.pictureInPictureElement) void document.exitPictureInPicture();
  }, [streams.length]);

  const goFullscreen = () => toggleFullscreen(stageRef.current);

  return (
    <section
      ref={stageRef}
      className={cn(
        // No celular o palco acompanha o vídeo (16:9); no desktop ocupa o espaço livre.
        'relative flex shrink-0 flex-col bg-black md:min-h-0 md:flex-1',
        streams.length === 0 && 'min-h-40',
      )}
      aria-label="Transmissões"
    >
      {streams.length === 0 ? (
        <p className="m-auto p-4 text-center text-sm text-neutral-400">{placeholder}</p>
      ) : (
        <>
          <div className="flex items-center gap-2 px-2 pt-2">
            {streams.length > 1 && (
              <>
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Escolher transmissão">
                  {streams.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={layout === 'focus' && s === selected}
                      onClick={() => {
                        setSelectedId(s.id);
                        setLayout('focus');
                      }}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-white/80 hover:bg-white/10',
                        layout === 'focus' && s === selected && 'bg-white/15 text-white',
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
                      {s.isLocal ? 'Sua tela' : s.name}
                    </button>
                  ))}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/10 hover:text-white"
                      onClick={() => setLayout(layout === 'focus' ? 'grid' : 'focus')}
                      aria-label={layout === 'focus' ? 'Ver lado a lado' : 'Ver uma por vez'}
                    >
                      {layout === 'focus' ? <Columns2 /> : <Square />}
                      <span className="hidden sm:inline">{layout === 'focus' ? 'Lado a lado' : 'Foco'}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{layout === 'focus' ? 'Ver todas as transmissões juntas' : 'Ver uma transmissão grande'}</TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="ml-auto text-white hover:bg-white/10 hover:text-white"
                  onClick={goFullscreen}
                  aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                >
                  {fullscreen ? <Minimize /> : <Maximize />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{fullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'}</TooltipContent>
            </Tooltip>
          </div>

          {layout === 'grid' && streams.length > 1 ? (
            <div
              className="grid min-h-0 flex-1 gap-1 p-1 max-md:grid-cols-1! max-md:[&>*]:aspect-video"
              style={{ gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(streams.length))}, minmax(0, 1fr))` }}
            >
              {streams.map((s) => (
                <VideoTile key={s.id} stream={s} onDoubleClick={goFullscreen} />
              ))}
            </div>
          ) : (
            <>
              <div className="aspect-video p-1 md:aspect-auto md:min-h-0 md:flex-1">
                {selected && <VideoTile key={selected.id} stream={selected} primary onDoubleClick={goFullscreen} />}
              </div>
              {others.length > 0 && (
                <div className="flex h-20 shrink-0 gap-1 overflow-x-auto p-1 md:h-24">
                  {others.map((s) => (
                    <div key={s.id} className="aspect-video h-full shrink-0">
                      <VideoTile stream={s} compact onSelect={() => setSelectedId(s.id)} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
