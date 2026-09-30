import { useEffect, useState } from 'react';
import { RoomEvent, Track, type Room, type VideoTrack } from 'livekit-client';

export interface ScreenStream {
  /** identity de quem transmite */
  id: string;
  name: string;
  isLocal: boolean;
  track: VideoTrack;
}

/** Todas as transmissões de tela da sala, incluindo a sua (como prévia). */
export function useScreenShares(room: Room): ScreenStream[] {
  const [streams, setStreams] = useState<ScreenStream[]>([]);

  useEffect(() => {
    const update = () => {
      const list: ScreenStream[] = [];
      const local = room.localParticipant;
      const localTrack = local.getTrackPublication(Track.Source.ScreenShare)?.track;
      if (localTrack) {
        list.push({ id: local.identity || 'local', name: local.name || 'Você', isLocal: true, track: localTrack as VideoTrack });
      }
      for (const p of room.remoteParticipants.values()) {
        const pub = p.getTrackPublication(Track.Source.ScreenShare);
        if (pub?.isSubscribed && pub.track) {
          list.push({ id: p.identity, name: p.name || p.identity, isLocal: false, track: pub.track as VideoTrack });
        }
      }
      setStreams(list);
    };
    const events = [
      RoomEvent.Connected,
      RoomEvent.Disconnected,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      // TrackUnsubscribed chega antes de a publicação sair da lista; TrackUnpublished, depois.
      RoomEvent.TrackUnpublished,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ParticipantNameChanged,
    ] as const;
    events.forEach((e) => room.on(e, update));
    update();
    return () => {
      events.forEach((e) => room.off(e, update));
    };
  }, [room]);

  return streams;
}
