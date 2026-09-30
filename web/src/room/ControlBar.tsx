import type { ReactNode } from 'react';
import {
  ArrowLeftRight,
  Headphones,
  LayoutGrid,
  LogOut,
  Maximize,
  Mic,
  Minimize,
  MonitorUp,
  Radio,
  Settings,
  Smartphone,
  Square,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { QualityId } from '@/quality';
import { ShareSettings } from '@/ShareSettings';
import type { Layout } from '@/stage/Stage';

interface ControlButtonProps {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  /** Esconde em telas estreitas (celular). */
  desktopOnly?: boolean;
}

/** Botão da barra: ícone em cima, rótulo embaixo (rótulo some em telas estreitas). */
function ControlButton({ icon, label, hint, onClick, disabled, active, className, desktopOnly }: ControlButtonProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-12 min-w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-md border px-2.5 text-[11px] text-muted-foreground transition-colors',
        'hover:border-input hover:bg-surface-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none [&_svg]:size-[18px]',
        active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-transparent',
        className,
      )}
    >
      {icon}
      <span className="leading-none max-sm:hidden">{label}</span>
    </button>
  );
  if (!hint) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span: tooltips funcionam mesmo com o botão desabilitado */}
        <span className={cn('inline-flex', desktopOnly && 'max-md:hidden')}>{button}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{hint}</TooltipContent>
    </Tooltip>
  );
}

interface Props {
  layout: Layout;
  onLayoutChange: (layout: Layout) => void;
  streamCount: number;
  onCycleStream: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  canShare: boolean;
  connected: boolean;
  broadcasting: boolean;
  broadcastElapsed: string | null;
  onToggleBroadcast: () => void;
  onShareScreen: () => void;
  quality: QualityId;
  onQualityChange: (id: QualityId) => void;
  audio: boolean;
  onAudioChange: (enabled: boolean) => void;
  onLeave: () => void;
}

export function ControlBar(props: Props) {
  const { layout, onLayoutChange, streamCount, canShare, connected, broadcasting } = props;
  const voiceHint = 'Em breve. Por enquanto a voz fica no Discord.';

  return (
    <footer className="z-30 flex h-16 shrink-0 items-center gap-2 overflow-x-auto border-t bg-card px-2 max-md:sticky max-md:bottom-0 md:px-3" aria-label="Controles da sala">
      {/* Visualização */}
      <div className="flex shrink-0 gap-1" role="group" aria-label="Visualização">
        <ControlButton icon={<LayoutGrid />} label="Grade" hint="Todas as transmissões (G)" active={layout === 'grid'} onClick={() => onLayoutChange('grid')} />
        <ControlButton icon={<Square />} label="Foco" hint="Ampliar a selecionada (G)" active={layout === 'focus'} onClick={() => onLayoutChange('focus')} disabled={streamCount === 0} />
      </div>

      {/* Ações centrais */}
      <div className="mx-auto flex shrink-0 items-center gap-1">
        <ControlButton icon={<Mic />} label="Mic" hint={voiceHint} disabled desktopOnly />
        <ControlButton icon={<Headphones />} label="Áudio" hint={voiceHint} disabled desktopOnly />

        {canShare ? (
          <>
            <ControlButton
              icon={<MonitorUp />}
              label="Compartilhar tela"
              hint={broadcasting ? 'Trocar a tela ou janela sem parar a transmissão' : 'Escolher a tela e começar a transmitir'}
              onClick={props.onShareScreen}
              disabled={!connected}
            />
            <button
              type="button"
              onClick={props.onToggleBroadcast}
              disabled={!connected}
              data-live={broadcasting}
              aria-label={broadcasting ? 'Parar transmissão' : 'Transmitir'}
              className={cn(
                'group/live mx-1 flex h-12 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40',
                'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none',
                // Transmitindo: anel de destaque; ao passar o mouse, vira o vermelho de "parar".
                'data-[live=true]:ring-2 data-[live=true]:ring-primary/35 data-[live=true]:ring-offset-2 data-[live=true]:ring-offset-card',
                'data-[live=true]:hover:bg-live data-[live=true]:hover:text-white data-[live=true]:hover:ring-live/35',
              )}
            >
              {broadcasting ? (
                <>
                  <span className="size-2.5 animate-pulse rounded-full bg-live group-hover/live:bg-white" aria-hidden />
                  <span>Parar transmissão</span>
                  {props.broadcastElapsed && (
                    <span className="font-mono text-xs font-medium tabular-nums opacity-80">{props.broadcastElapsed}</span>
                  )}
                </>
              ) : (
                <>
                  <Radio className="size-[18px]" />
                  <span>Transmitir</span>
                </>
              )}
            </button>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mx-1 flex h-12 items-center gap-2 rounded-md border px-3 text-xs text-muted-foreground">
                <Smartphone className="size-4" />
                <span className="max-sm:hidden">Celular só assiste</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">Navegadores de celular não permitem compartilhar a tela</TooltipContent>
          </Tooltip>
        )}

        <ControlButton
          icon={<ArrowLeftRight />}
          label="Alternar tela"
          hint="Próxima transmissão (teclas 1–9 escolhem direto)"
          onClick={props.onCycleStream}
          disabled={streamCount < 2}
        />
        <ControlButton
          icon={props.fullscreen ? <Minimize /> : <Maximize />}
          label="Tela cheia"
          hint="Tela cheia das transmissões (F)"
          onClick={props.onToggleFullscreen}
          disabled={streamCount === 0}
          active={props.fullscreen}
        />
        {canShare && (
          <ShareSettings
            quality={props.quality}
            onQualityChange={props.onQualityChange}
            audio={props.audio}
            onAudioChange={props.onAudioChange}
            sharing={broadcasting}
          >
            <button
              type="button"
              aria-label="Configurações"
              className="flex h-12 min-w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-transparent px-2.5 text-[11px] text-muted-foreground transition-colors hover:border-input hover:bg-surface-2 hover:text-foreground data-[state=open]:border-primary/40 data-[state=open]:text-primary [&_svg]:size-[18px]"
            >
              <Settings />
              <span className="leading-none max-sm:hidden">Configurações</span>
            </button>
          </ShareSettings>
        )}
      </div>

      <button
        type="button"
        onClick={props.onLeave}
        aria-label="Sair da sala"
        className="flex h-12 shrink-0 items-center gap-2 rounded-md border border-live/50 px-3 text-sm font-medium text-live transition-colors hover:bg-live hover:text-white [&_svg]:size-[18px]"
      >
        <LogOut />
        <span className="max-sm:hidden">Sair da sala</span>
      </button>
    </footer>
  );
}
