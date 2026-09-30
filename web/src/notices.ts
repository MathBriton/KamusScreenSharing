import { RoomEvent, Track, type RemoteParticipant, type RemoteTrackPublication, type Room } from 'livekit-client';

export type NoticeKind = 'joined' | 'left' | 'live' | 'stopped';

export interface Notice {
  kind: NoticeKind;
  name: string;
  text: string;
}

const TEXTS: Record<NoticeKind, (name: string) => string> = {
  joined: (n) => `${n} entrou na sala`,
  left: (n) => `${n} saiu da sala`,
  live: (n) => `${n} começou a transmitir`,
  stopped: (n) => `${n} parou de transmitir`,
};

/** Avisa sobre entradas, saídas e início/fim de transmissão de outros participantes. */
export function subscribeNotices(room: Room, onNotice: (notice: Notice) => void): () => void {
  const emit = (kind: NoticeKind, p: RemoteParticipant) => {
    const name = p.name || 'Alguém';
    onNotice({ kind, name, text: TEXTS[kind](name) });
  };
  const joined = (p: RemoteParticipant) => emit('joined', p);
  const left = (p: RemoteParticipant) => emit('left', p);
  const published = (pub: RemoteTrackPublication, p: RemoteParticipant) => {
    if (pub.source === Track.Source.ScreenShare) emit('live', p);
  };
  const unpublished = (pub: RemoteTrackPublication, p: RemoteParticipant) => {
    if (pub.source === Track.Source.ScreenShare) emit('stopped', p);
  };

  room
    .on(RoomEvent.ParticipantConnected, joined)
    .on(RoomEvent.ParticipantDisconnected, left)
    .on(RoomEvent.TrackPublished, published)
    .on(RoomEvent.TrackUnpublished, unpublished);
  return () => {
    room
      .off(RoomEvent.ParticipantConnected, joined)
      .off(RoomEvent.ParticipantDisconnected, left)
      .off(RoomEvent.TrackPublished, published)
      .off(RoomEvent.TrackUnpublished, unpublished);
  };
}
