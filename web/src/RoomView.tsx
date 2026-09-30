import { useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type LocalVideoTrack,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { Check, Copy, Eye, LogOut, MonitorOff, MonitorUp, Presentation, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fetchToken, type Role } from './api';
import { Chat } from './chat/Chat';
import { canShareScreen } from './device';
import { subscribeNotices } from './notices';
import { ParticipantList } from './ParticipantList';
import { useParticipants } from './participants';
import { DEFAULT_QUALITY, QUALITY_PRESETS, applyQuality, captureOptions, getPreset, publishOptions, type QualityId } from './quality';
import { roomPath } from './rooms';
import { ShareSettings } from './ShareSettings';
import { Stage } from './stage/Stage';
import { useScreenShares } from './stage/useScreenShares';

const STATE_LABELS: Record<ConnectionState, string> = {
  [ConnectionState.Connected]: 'Conectado',
  [ConnectionState.Connecting]: 'Conectando…',
  [ConnectionState.Reconnecting]: 'Reconectando…',
  [ConnectionState.SignalReconnecting]: 'Reconectando…',
  [ConnectionState.Disconnected]: 'Desconectado',
};

const QUALITY_KEY = 'kamus:quality';
const AUDIO_KEY = 'kamus:share-audio';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem armazenamento local: a preferência vale só nesta visita.
  }
}

function loadQuality(): QualityId {
  const saved = loadPref(QUALITY_KEY);
  return QUALITY_PRESETS.some((p) => p.id === saved) ? (saved as QualityId) : DEFAULT_QUALITY;
}

interface Props {
  room: string;
  initialRole: Role;
  name: string;
  onRoleChange: (role: Role) => void;
  onLeave: () => void;
}

export function RoomView({ room: roomName, initialRole, name, onRoleChange, onLeave }: Props) {
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  // No celular não dá para transmitir: quem chega com link de apresentador entra assistindo.
  const startRole: Role = canShareScreen ? initialRole : 'viewer';
  // O token é pedido com o papel inicial; depois o papel muda só pelo atributo.
  const initialRoleRef = useRef(startRole);
  const [role, setRole] = useState(startRole);
  const [state, setState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [token, setToken] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [quality, setQuality] = useState<QualityId>(loadQuality);
  const [audio, setAudio] = useState(() => loadPref(AUDIO_KEY) === '1');

  useEffect(() => {
    if (startRole !== initialRole) onRoleChange(startRole);
    // Só na montagem: corrige o link de apresentador aberto no celular.
  }, []);

  useEffect(() => {
    // O vídeo é exibido pelo palco; aqui só o áudio das transmissões (se houver).
    const onSubscribed = (track: RemoteTrack, pub: RemoteTrackPublication) => {
      if (pub.source === Track.Source.ScreenShareAudio) track.attach();
    };
    const onUnsubscribed = (track: RemoteTrack, pub: RemoteTrackPublication) => {
      if (pub.source === Track.Source.ScreenShareAudio) track.detach();
    };
    const onLocalUnpublished = () => setSharing(room.localParticipant.isScreenShareEnabled);

    room
      .on(RoomEvent.ConnectionStateChanged, setState)
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);

    let cancelled = false;
    (async () => {
      try {
        const { token, url } = await fetchToken(roomName, name, initialRoleRef.current);
        if (cancelled) return;
        await room.connect(url, token);
        if (!cancelled) setToken(token);
      } catch (err) {
        if (!cancelled) toast.error('Não foi possível entrar na sala', { description: errorMessage(err) });
      }
    })();

    return () => {
      cancelled = true;
      room
        .off(RoomEvent.ConnectionStateChanged, setState)
        .off(RoomEvent.TrackSubscribed, onSubscribed)
        .off(RoomEvent.TrackUnsubscribed, onUnsubscribed)
        .off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
      room.disconnect();
    };
  }, [room, roomName, name]);

  // Avisos de entrada/saída e de início/fim de transmissão.
  useEffect(() => subscribeNotices(room, (n) => toast(n.text, { duration: 3000 })), [room]);

  const toggleShare = async () => {
    try {
      if (room.localParticipant.isScreenShareEnabled) {
        await room.localParticipant.setScreenShareEnabled(false);
      } else {
        const preset = getPreset(quality);
        await room.localParticipant.setScreenShareEnabled(true, captureOptions(preset, audio), publishOptions(preset));
      }
      setSharing(room.localParticipant.isScreenShareEnabled);
    } catch (err) {
      // O usuário cancelar o seletor de tela não é um erro relevante.
      if (err instanceof Error && err.name === 'NotAllowedError') return;
      toast.error('Não foi possível compartilhar a tela', { description: errorMessage(err) });
    }
  };

  const changeQuality = async (id: QualityId) => {
    setQuality(id);
    savePref(QUALITY_KEY, id);
    const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
    if (!track) return;
    const preset = getPreset(id);
    try {
      await applyQuality(track as LocalVideoTrack, preset);
      toast.success(`Qualidade: ${preset.label}`, { description: preset.description, duration: 2000 });
    } catch (err) {
      toast.error('Não foi possível trocar a qualidade', { description: errorMessage(err) });
    }
  };

  const changeAudio = (enabled: boolean) => {
    setAudio(enabled);
    savePref(AUDIO_KEY, enabled ? '1' : '0');
  };

  const switchRole = async (next: Role) => {
    try {
      if (next === 'viewer' && room.localParticipant.isScreenShareEnabled) {
        await room.localParticipant.setScreenShareEnabled(false);
        setSharing(false);
      }
      await room.localParticipant.setAttributes({ role: next });
      setRole(next);
      onRoleChange(next);
    } catch (err) {
      toast.error('Não foi possível trocar de papel', { description: errorMessage(err) });
    }
  };

  const shareLink = `${window.location.origin}${roomPath(roomName)}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {
      toast.error('Não foi possível copiar', { description: shareLink });
      return;
    }
    toast.success('Link copiado!', { description: 'Envie para quem vai assistir.' });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const participants = useParticipants(room);
  const streams = useScreenShares(room);
  const viewers = participants.filter((p) => p.role === 'viewer').length;
  const live = participants.filter((p) => p.isSharing).length;
  const connected = state === ConnectionState.Connected;

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto md:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <strong className="font-semibold">Sala {roomName}</strong>
          <Badge
            variant="outline"
            className={connected ? 'border-green-600/40 text-green-700 dark:text-green-400' : undefined}
          >
            {STATE_LABELS[state]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {viewers === 1 ? '1 espectador' : `${viewers} espectadores`}
            {live > 1 && ` · ${live} transmissões`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyLink}>
            {copied ? <Check /> : <Copy />}
            Copiar link
          </Button>
          {!canShareScreen ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="h-9 gap-1.5 px-3">
                  <Smartphone />
                  Só assistir
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Navegadores de celular não permitem compartilhar a tela.</TooltipContent>
            </Tooltip>
          ) : role === 'presenter' ? (
            <>
              <ShareSettings
                quality={quality}
                onQualityChange={changeQuality}
                audio={audio}
                onAudioChange={changeAudio}
                sharing={sharing}
              />
              <Button variant={sharing ? 'destructive' : 'default'} onClick={toggleShare} disabled={!connected}>
                {sharing ? <MonitorOff /> : <MonitorUp />}
                {sharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
              </Button>
              {!sharing && (
                <Button variant="ghost" onClick={() => switchRole('viewer')} disabled={!connected}>
                  <Eye />
                  Só assistir
                </Button>
              )}
            </>
          ) : (
            <Button onClick={() => switchRole('presenter')} disabled={!connected}>
              <Presentation />
              Apresentar
            </Button>
          )}
          <Button variant="ghost" onClick={onLeave}>
            <LogOut />
            Sair
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Stage
          streams={streams}
          placeholder={
            role === 'presenter'
              ? 'Clique em "Compartilhar tela" para começar a transmitir.'
              : 'Aguardando alguém compartilhar a tela…'
          }
        />

        <aside className="flex min-h-0 flex-1 flex-col border-t bg-card md:w-80 md:flex-none md:border-t-0 md:border-l">
          <ParticipantList participants={participants} />
          <Separator />
          <Chat room={room} roomName={roomName} token={token} connected={connected} />
        </aside>
      </div>
    </main>
  );
}
