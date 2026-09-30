import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionQuality,
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type LocalVideoTrack,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { toast } from 'sonner';
import { fetchRoomInfo, fetchToken } from '@/api';
import { Chat } from '@/chat/Chat';
import { canShareScreen } from '@/device';
import { subscribeNotices } from '@/notices';
import { useParticipants } from '@/participants';
import { DEFAULT_QUALITY, QUALITY_PRESETS, applyQuality, captureOptions, getPreset, publishOptions, type QualityId } from '@/quality';
import { isTypingTarget, toggleFullscreen } from '@/stage/media';
import { Stage, type Layout } from '@/stage/Stage';
import { useScreenShares, type ScreenStream } from '@/stage/useScreenShares';
import { ControlBar } from './ControlBar';
import { ParticipantsPanel } from './ParticipantsPanel';
import { RoomTopBar } from './RoomTopBar';
import { useElapsed, usePing, useStreamStats } from './useMetrics';

const STATUS_LABELS: Partial<Record<ConnectionState, string>> = {
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

/** Prefere assistir a tela de outra pessoa em vez da própria prévia. */
function pickDefault(streams: ScreenStream[]): ScreenStream | undefined {
  return streams.find((s) => !s.isLocal) ?? streams[0];
}

interface Props {
  room: string;
  name: string;
  onLeave: () => void;
  onJoinRoom: (room: string) => void;
}

export function RoomView({ room: roomName, name, onLeave, onJoinRoom }: Props) {
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  const stageRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [token, setToken] = useState<string | null>(null);
  const [roomCreatedAt, setRoomCreatedAt] = useState<number | null>(null);
  const [broadcastStartedAt, setBroadcastStartedAt] = useState<number | null>(null);
  const [quality, setQuality] = useState<QualityId>(loadQuality);
  const [audio, setAudio] = useState(() => loadPref(AUDIO_KEY) === '1');
  const [layout, setLayout] = useState<Layout>('grid');
  const [selectedId, setSelectedId] = useState<string>();
  const [fullscreen, setFullscreen] = useState(false);
  const [myConnection, setMyConnection] = useState(ConnectionQuality.Unknown);

  const connected = state === ConnectionState.Connected;
  const broadcasting = broadcastStartedAt !== null;

  useEffect(() => {
    // O vídeo é exibido pelo palco; aqui só o áudio das transmissões (se houver).
    const onSubscribed = (track: RemoteTrack, pub: RemoteTrackPublication) => {
      if (pub.source === Track.Source.ScreenShareAudio) track.attach();
    };
    const onUnsubscribed = (track: RemoteTrack, pub: RemoteTrackPublication) => {
      if (pub.source === Track.Source.ScreenShareAudio) track.detach();
    };
    // Parou pelo botão do navegador ("Parar compartilhamento"): sincroniza o estado.
    const onLocalUnpublished = () => {
      if (!room.localParticipant.isScreenShareEnabled) {
        setBroadcastStartedAt(null);
        void room.localParticipant.setAttributes({ role: 'viewer', fps: '' }).catch(() => {});
      }
    };
    const onQuality = (q: ConnectionQuality, p: { isLocal: boolean }) => p.isLocal && setMyConnection(q);

    room
      .on(RoomEvent.ConnectionStateChanged, setState)
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
      .on(RoomEvent.ConnectionQualityChanged, onQuality);

    let cancelled = false;
    (async () => {
      try {
        const { token, url } = await fetchToken(roomName, name, 'viewer');
        if (cancelled) return;
        await room.connect(url, token);
        if (cancelled) return;
        setToken(token);
        const info = await fetchRoomInfo(roomName, token).catch(() => null);
        if (!cancelled) setRoomCreatedAt(info?.createdAt ?? Date.now());
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
        .off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
        .off(RoomEvent.ConnectionQualityChanged, onQuality);
      room.disconnect();
    };
  }, [room, roomName, name]);

  // Avisos de entrada/saída e de início/fim de transmissão.
  useEffect(() => subscribeNotices(room, (n) => toast(n.text, { duration: 3000 })), [room]);

  // ---- Transmissão ----

  const startBroadcast = async () => {
    const preset = getPreset(quality);
    await room.localParticipant.setScreenShareEnabled(true, captureOptions(preset, audio), publishOptions(preset));
    if (!room.localParticipant.isScreenShareEnabled) return;
    setBroadcastStartedAt(Date.now());
    await room.localParticipant.setAttributes({ role: 'presenter', fps: String(preset.fps) });
  };

  const stopBroadcast = async () => {
    await room.localParticipant.setScreenShareEnabled(false);
    setBroadcastStartedAt(null);
    await room.localParticipant.setAttributes({ role: 'viewer', fps: '' });
  };

  const handle = (action: () => Promise<void>, failure: string) => async () => {
    try {
      await action();
    } catch (err) {
      // Cancelar o seletor de tela não é um erro relevante.
      if (err instanceof Error && err.name === 'NotAllowedError') return;
      toast.error(failure, { description: errorMessage(err) });
    }
  };

  const toggleBroadcast = handle(
    () => (room.localParticipant.isScreenShareEnabled ? stopBroadcast() : startBroadcast()),
    'Não foi possível transmitir',
  );

  /** Troca a tela/janela compartilhada sem derrubar a transmissão (os outros não veem interrupção). */
  const shareScreen = handle(async () => {
    const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as LocalVideoTrack | undefined;
    if (!track) return startBroadcast();
    const preset = getPreset(quality);
    const media = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: preset.width }, height: { ideal: preset.height }, frameRate: { ideal: preset.fps } },
      audio: false,
      // Opções do Chrome para o seletor de tela.
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
    } as DisplayMediaStreamOptions);
    const next = media.getVideoTracks()[0];
    next.contentHint = preset.contentHint;
    await track.replaceTrack(next);
    toast.success('Tela trocada', { description: 'A transmissão continuou sem interrupção.', duration: 2000 });
  }, 'Não foi possível trocar a tela');

  const changeQuality = async (id: QualityId) => {
    setQuality(id);
    savePref(QUALITY_KEY, id);
    const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
    if (!track) return;
    const preset = getPreset(id);
    try {
      await applyQuality(track as LocalVideoTrack, preset);
      await room.localParticipant.setAttributes({ fps: String(preset.fps) });
      toast.success(`Qualidade: ${preset.label}`, { description: preset.description, duration: 2000 });
    } catch (err) {
      toast.error('Não foi possível trocar a qualidade', { description: errorMessage(err) });
    }
  };

  const changeAudio = (enabled: boolean) => {
    setAudio(enabled);
    savePref(AUDIO_KEY, enabled ? '1' : '0');
  };

  // ---- Visualização ----

  const participants = useParticipants(room);
  const streams = useScreenShares(room);
  const selected = streams.find((s) => s.id === selectedId) ?? pickDefault(streams);

  const select = useCallback((id: string) => setSelectedId(id), []);
  const toggleFocus = (id: string) => {
    setSelectedId(id);
    setLayout((l) => (l === 'focus' && id === selected?.id ? 'grid' : 'focus'));
  };
  const cycleStream = useCallback(() => {
    if (streams.length < 2) return;
    const index = selected ? streams.indexOf(selected) : -1;
    setSelectedId(streams[(index + 1) % streams.length].id);
  }, [streams, selected]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement && document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Atalhos: F tela cheia, G grade/foco, 1–9 escolhe a transmissão.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if ((e.key === 'f' || e.key === 'F') && streams.length > 0) toggleFullscreen(stageRef.current);
      else if ((e.key === 'g' || e.key === 'G') && streams.length > 0) setLayout((l) => (l === 'grid' ? 'focus' : 'grid'));
      else if (/^[1-9]$/.test(e.key) && streams[Number(e.key) - 1]) setSelectedId(streams[Number(e.key) - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [streams]);

  // A janela flutuante não faz sentido sem transmissão.
  useEffect(() => {
    if (streams.length === 0 && document.pictureInPictureElement) void document.exitPictureInPicture();
  }, [streams.length]);

  // ---- Métricas ----

  const ping = usePing(room, connected);
  const stats = useStreamStats(selected?.track);
  const elapsed = useElapsed(connected ? roomCreatedAt : null);
  const broadcastElapsed = useElapsed(broadcastStartedAt);

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:min-h-0">
      <RoomTopBar
        connectionStatus={STATUS_LABELS[state]}
        roomName={roomName}
        count={participants.length}
        live={streams.length > 0}
        elapsed={elapsed}
        ping={ping}
        connection={myConnection}
        stats={stats}
        statsOwner={selected ? (selected.isLocal ? 'você' : selected.name) : undefined}
        onHome={onLeave}
        onJoinRoom={onJoinRoom}
      />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Stage
          stageRef={stageRef}
          streams={streams}
          participants={participants}
          layout={layout}
          selected={selected}
          onSelect={select}
          onToggleFocus={toggleFocus}
          placeholder={
            <div className="grid gap-1 p-6">
              <p className="text-sm text-foreground">Ninguém transmitindo</p>
              <p className="text-xs text-muted-foreground">
                {!connected
                  ? 'Conectando…'
                  : canShareScreen
                    ? 'Clique em "Transmitir" para compartilhar sua tela.'
                    : 'Aguardando alguém compartilhar a tela.'}
              </p>
            </div>
          }
        />

        <aside className="flex min-h-[28rem] flex-col border-t bg-card md:min-h-0 md:w-[22rem] md:border-t-0 md:border-l">
          <ParticipantsPanel participants={participants} />
          <Chat
            room={room}
            roomName={roomName}
            token={token}
            connected={connected}
            participantNames={participants.map((p) => p.name)}
          />
        </aside>
      </div>

      <ControlBar
        layout={layout}
        onLayoutChange={setLayout}
        streamCount={streams.length}
        onCycleStream={cycleStream}
        fullscreen={fullscreen}
        onToggleFullscreen={() => toggleFullscreen(stageRef.current)}
        canShare={canShareScreen}
        connected={connected}
        broadcasting={broadcasting}
        broadcastElapsed={broadcastElapsed}
        onToggleBroadcast={toggleBroadcast}
        onShareScreen={shareScreen}
        quality={quality}
        onQualityChange={changeQuality}
        audio={audio}
        onAudioChange={changeAudio}
        onLeave={onLeave}
      />
    </div>
  );
}
