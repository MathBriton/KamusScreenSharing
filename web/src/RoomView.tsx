import { useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { Check, Copy, LogOut, MonitorOff, MonitorUp } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { fetchToken, type Role } from './api';
import { Chat } from './Chat';
import { ParticipantList } from './ParticipantList';
import { useParticipants } from './participants';

const STATE_LABELS: Record<ConnectionState, string> = {
  [ConnectionState.Connected]: 'Conectado',
  [ConnectionState.Connecting]: 'Conectando…',
  [ConnectionState.Reconnecting]: 'Reconectando…',
  [ConnectionState.SignalReconnecting]: 'Reconectando…',
  [ConnectionState.Disconnected]: 'Desconectado',
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface Props {
  room: string;
  role: Role;
  name: string;
  onLeave: () => void;
}

export function RoomView({ room: roomName, role, name, onLeave }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  const [state, setState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [sharing, setSharing] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  const [copied, setCopied] = useState(false);

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
        const { token, url } = await fetchToken(roomName, name, role);
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
  }, [room, roomName, name, role]);

  const toggleShare = async () => {
    try {
      const enable = !room.localParticipant.isScreenShareEnabled;
      const pub = await room.localParticipant.setScreenShareEnabled(enable, { audio: true });
      if (enable && pub?.track) {
        pub.track.attach(videoRef.current!);
      }
      setSharing(room.localParticipant.isScreenShareEnabled);
    } catch (err) {
      // O usuário cancelar o seletor de tela não é um erro relevante.
      if (err instanceof Error && err.name === 'NotAllowedError') return;
      toast.error('Não foi possível compartilhar a tela', { description: errorMessage(err) });
    }
  };

  const shareLink = `${window.location.origin}/?sala=${encodeURIComponent(roomName)}`;
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

  const showVideo = role === 'presenter' ? sharing : hasStream;

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
          {role === 'presenter' && (
            <>
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check /> : <Copy />}
                Copiar link
              </Button>
              <Button
                variant={sharing ? 'destructive' : 'default'}
                onClick={toggleShare}
                disabled={!connected}
              >
                {sharing ? <MonitorOff /> : <MonitorUp />}
                {sharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={onLeave}>
            <LogOut />
            Sair
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="grid aspect-video min-h-0 place-items-center bg-black md:aspect-auto md:flex-1">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={role === 'presenter'}
            hidden={!showVideo}
            className="size-full object-contain"
          />
          {!showVideo && (
            <p className="p-4 text-center text-sm text-neutral-400">
              {role === 'presenter'
                ? 'Clique em "Compartilhar tela" para começar a transmitir.'
                : 'Aguardando o apresentador compartilhar a tela…'}
            </p>
          )}
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
