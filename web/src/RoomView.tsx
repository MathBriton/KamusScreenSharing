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
import { Check, Copy, Eye, LogOut, MonitorOff, MonitorUp, Presentation } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { fetchToken, type Role } from './api';
import { Chat } from './Chat';
import { subscribeNotices } from './notices';
import { ParticipantList } from './ParticipantList';
import { useParticipants } from './participants';
import { DEFAULT_QUALITY, QUALITY_PRESETS, applyQuality, captureOptions, getPreset, publishOptions, type QualityId } from './quality';
import { roomPath } from './rooms';
import { ShareSettings } from './ShareSettings';
import { StageControls, toggleFullscreen } from './StageControls';

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
  const stageRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  // O token é pedido com o papel inicial; depois o papel muda só pelo atributo.
  const initialRoleRef = useRef(initialRole);
  const [role, setRole] = useState(initialRole);
  const [state, setState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [sharing, setSharing] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  const [copied, setCopied] = useState(false);
  const [quality, setQuality] = useState<QualityId>(loadQuality);
  const [audio, setAudio] = useState(() => loadPref(AUDIO_KEY) === '1');

  useEffect(() => {
    const video = videoRef.current!;

    const attachIfScreen = (track: RemoteTrack, pub: RemoteTrackPublication) => {
      if (pub.source === Track.Source.ScreenShare) {
        track.attach(video);
        setHasStream(true);
      } else if (pub.source === Track.Source.ScreenShareAudio) {
        track.attach();
      }
    };
    const detach = (track: RemoteTrack, pub: RemoteTrackPublication) => {
      track.detach();
      if (pub.source === Track.Source.ScreenShare) setHasStream(false);
    };
    const onLocalUnpublished = () => {
      setSharing(room.localParticipant.isScreenShareEnabled);
    };

    room
      .on(RoomEvent.ConnectionStateChanged, setState)
      .on(RoomEvent.TrackSubscribed, attachIfScreen)
      .on(RoomEvent.TrackUnsubscribed, detach)
      .on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);

    let cancelled = false;
    (async () => {
      try {
        const { token, url } = await fetchToken(roomName, name, initialRoleRef.current);
        if (cancelled) return;
        await room.connect(url, token);
      } catch (err) {
        if (!cancelled) toast.error('Não foi possível entrar na sala', { description: errorMessage(err) });
      }
    })();

    return () => {
      cancelled = true;
      room
        .off(RoomEvent.ConnectionStateChanged, setState)
        .off(RoomEvent.TrackSubscribed, attachIfScreen)
        .off(RoomEvent.TrackUnsubscribed, detach)
        .off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
      room.disconnect();
    };
  }, [room, roomName, name]);

  // Avisos de entrada/saída e de início/fim de transmissão.
  useEffect(() => subscribeNotices(room, (n) => toast(n.text, { duration: 3000 })), [room]);

  const showVideo = sharing || hasStream;

  // A janela flutuante não faz sentido sem transmissão.
  useEffect(() => {
    if (!showVideo && document.pictureInPictureElement) void document.exitPictureInPicture();
  }, [showVideo]);

  const toggleShare = async () => {
    try {
      if (room.localParticipant.isScreenShareEnabled) {
        await room.localParticipant.setScreenShareEnabled(false);
      } else {
        const preset = getPreset(quality);
        const pub = await room.localParticipant.setScreenShareEnabled(
          true,
          captureOptions(preset, audio),
          publishOptions(preset),
        );
        pub?.track?.attach(videoRef.current!);
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
  const viewers = participants.filter((p) => p.role === 'viewer').length;
  const connected = state === ConnectionState.Connected;
  const someoneElseSharing = participants.some((p) => !p.isLocal && p.isSharing);
  const watching = hasStream && !sharing;

  return (
    <main className="flex min-h-screen flex-col md:h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
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
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyLink}>
            {copied ? <Check /> : <Copy />}
            Copiar link
          </Button>
          {role === 'presenter' ? (
            <>
              <ShareSettings
                quality={quality}
                onQualityChange={changeQuality}
                audio={audio}
                onAudioChange={changeAudio}
                sharing={sharing}
              />
              <Button
                variant={sharing ? 'destructive' : 'default'}
                onClick={toggleShare}
                disabled={!connected || (!sharing && someoneElseSharing)}
                title={!sharing && someoneElseSharing ? 'Outra pessoa já está transmitindo' : undefined}
              >
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
            <Button
              onClick={() => switchRole('presenter')}
              disabled={!connected || someoneElseSharing}
              title={someoneElseSharing ? 'Outra pessoa já está transmitindo' : undefined}
            >
              <Presentation />
              Apresentar
            </Button>
          )}
          <Button variant="ghost" onClick={onLeave}>
            <LogOut />
            Sair
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          ref={stageRef}
          className="group relative grid aspect-video min-h-0 place-items-center bg-black md:aspect-auto md:flex-1"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            hidden={!showVideo}
            onDoubleClick={() => watching && toggleFullscreen(stageRef.current)}
            className="size-full object-contain"
          />
          {!showVideo && (
            <p className="p-4 text-center text-sm text-neutral-400">
              {role === 'presenter'
                ? 'Clique em "Compartilhar tela" para começar a transmitir.'
                : 'Aguardando alguém compartilhar a tela…'}
            </p>
          )}
          {watching && <StageControls stageRef={stageRef} videoRef={videoRef} />}
        </section>

        <aside className="flex min-h-0 flex-1 flex-col border-t bg-card md:w-80 md:flex-none md:border-t-0 md:border-l">
          <ParticipantList participants={participants} />
          <Separator />
          <Chat room={room} connected={connected} />
        </aside>
      </div>
    </main>
  );
}
