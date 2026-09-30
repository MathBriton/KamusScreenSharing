import { useEffect, useState } from 'react';
import { RoomEvent, type Participant, type Room } from 'livekit-client';
import type { Role } from './api';

export interface ParticipantInfo {
  identity: string;
  name: string;
  role: Role;
  isLocal: boolean;
  isSharing: boolean;
}

function toInfo(p: Participant): ParticipantInfo {
  return {
    identity: p.identity,
    name: p.name || p.identity,
    role: p.attributes.role === 'presenter' ? 'presenter' : 'viewer',
    isLocal: p.isLocal,
    isSharing: p.isScreenShareEnabled,
  };
}

function snapshot(room: Room): ParticipantInfo[] {
  const all = [room.localParticipant, ...room.remoteParticipants.values()].map(toInfo);
  // Apresentadores primeiro, depois por nome.
  return all.sort((a, b) =>
    a.role === b.role ? a.name.localeCompare(b.name, 'pt-BR') : a.role === 'presenter' ? -1 : 1,
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
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
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
