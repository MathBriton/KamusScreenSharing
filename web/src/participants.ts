import { useEffect, useState } from 'react';
import { ConnectionQuality, RoomEvent, Track, type Participant, type Room } from 'livekit-client';

export interface ParticipantInfo {
  identity: string;
  name: string;
  isLocal: boolean;
  isSharing: boolean;
  connection: ConnectionQuality;
  /** Altura da transmissão (ex.: 1080), quando está transmitindo. */
  height?: number;
  /** FPS do preset escolhido por quem transmite (atributo "fps"). */
  fps?: number;
}

function toInfo(p: Participant): ParticipantInfo {
  const screen = p.getTrackPublication(Track.Source.ScreenShare);
  const fps = Number(p.attributes.fps);
  return {
    identity: p.identity,
    name: p.name || p.identity,
    isLocal: p.isLocal,
    isSharing: p.isScreenShareEnabled,
    connection: p.connectionQuality,
    height: screen?.dimensions?.height,
    fps: Number.isFinite(fps) && fps > 0 ? fps : undefined,
  };
}

function snapshot(room: Room): ParticipantInfo[] {
  const all = [room.localParticipant, ...room.remoteParticipants.values()].map(toInfo);
  // Quem transmite primeiro, depois por nome.
  return all.sort((a, b) =>
    a.isSharing === b.isSharing ? a.name.localeCompare(b.name, 'pt-BR') : a.isSharing ? -1 : 1,
  );
}

/** Lista de participantes da sala, sempre atualizada. */
export function useParticipants(room: Room): ParticipantInfo[] {
  const [list, setList] = useState<ParticipantInfo[]>([]);

  useEffect(() => {
    const update = () => setList(snapshot(room));
    const events = [
      RoomEvent.Connected,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ParticipantNameChanged,
      RoomEvent.ParticipantAttributesChanged,
      RoomEvent.ConnectionQualityChanged,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.TrackSubscribed,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
    ] as const;
    events.forEach((e) => room.on(e, update));
    update();
    return () => {
      events.forEach((e) => room.off(e, update));
    };
  }, [room]);

  return list;
}
