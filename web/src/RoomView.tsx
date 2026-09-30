import { useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { fetchToken, type Role } from './api';

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
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const video = videoRef.current!;
    const updateViewers = () => setViewers(room.remoteParticipants.size);

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
      .on(RoomEvent.TrackSubscribed, (track, pub) => attachIfScreen(track, pub))
      .on(RoomEvent.TrackUnsubscribed, (track, pub) => detach(track, pub))
      .on(RoomEvent.ParticipantConnected, updateViewers)
      .on(RoomEvent.ParticipantDisconnected, updateViewers)
      .on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);

    let cancelled = false;
    (async () => {
      try {
        const { token, url } = await fetchToken(roomName, name, role);
        if (cancelled) return;
        await room.connect(url, token);
        updateViewers();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      room.disconnect();
    };
  }, [room, roomName, name, role]);

  const toggleShare = async () => {
    setError(null);
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
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const shareLink = `${window.location.origin}/?sala=${encodeURIComponent(roomName)}`;
  const copyLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showVideo = role === 'presenter' ? sharing : hasStream;

  return (
    <main className="room">
      <header className="room-header">
        <div>
          <strong>Sala {roomName}</strong>
          <span className={`status status-${state}`}>{state}</span>
          <span className="muted">
            {role === 'presenter' ? `${viewers} espectador(es)` : 'Você está assistindo'}
          </span>
        </div>
        <div className="actions">
          {role === 'presenter' && (
            <>
              <button onClick={copyLink}>{copied ? 'Link copiado!' : 'Copiar link'}</button>
              <button onClick={toggleShare} disabled={state !== ConnectionState.Connected}>
                {sharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
              </button>
            </>
          )}
          <button className="secondary" onClick={onLeave}>
            Sair
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="stage">
        <video ref={videoRef} autoPlay playsInline muted={role === 'presenter'} hidden={!showVideo} />
        {!showVideo && (
          <p className="placeholder">
            {role === 'presenter'
              ? 'Clique em "Compartilhar tela" para começar a transmitir.'
              : 'Aguardando o apresentador compartilhar a tela…'}
          </p>
        )}
      </section>
    </main>
  );
}
