import { useEffect, useState, type RefObject } from 'react';
import { Maximize, Minimize, PictureInPicture2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  stageRef: RefObject<HTMLElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
}

const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

export function toggleFullscreen(stage: HTMLElement | null) {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void stage?.requestFullscreen();
}

export async function togglePictureInPicture(video: HTMLVideoElement | null) {
  if (!pipSupported || !video) return;
  if (document.pictureInPictureElement) await document.exitPictureInPicture();
  else await video.requestPictureInPicture();
}

/** Botões de tela cheia e picture-in-picture sobre o vídeo (atalhos: F e P). */
export function StageControls({ stageRef, videoRef }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [stageRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'f' || e.key === 'F') toggleFullscreen(stageRef.current);
      if (e.key === 'p' || e.key === 'P') void togglePictureInPicture(videoRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stageRef, videoRef]);

  return (
    <div className="absolute right-3 bottom-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
      {pipSupported && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="bg-black/60 text-white hover:bg-black/80"
              onClick={() => void togglePictureInPicture(videoRef.current)}
              aria-label="Picture-in-picture"
            >
              <PictureInPicture2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Janela flutuante (P)</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="secondary"
            className="bg-black/60 text-white hover:bg-black/80"
            onClick={() => toggleFullscreen(stageRef.current)}
            aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{fullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'}</TooltipContent>
      </Tooltip>
    </div>
  );
}
