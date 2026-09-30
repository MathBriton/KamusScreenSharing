import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { config } from './config.js';

export type Role = 'presenter' | 'viewer';

const ROOM_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidRoomName(room: string): boolean {
  return ROOM_NAME.test(room);
}

export async function createToken(room: string, identity: string, name: string, role: Role): Promise<string> {
  const token = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
    identity,
    name,
    ttl: '6h',
    // Papel inicial, visível para os outros participantes (lista de presentes).
    attributes: { role },
  });

  token.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    // Qualquer participante pode assumir a apresentação (salas fixas do grupo),
    // mas só compartilhamento de tela: nada de câmera ou microfone.
    canPublish: true,
    canPublishSources: [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
    canPublishData: true,
    // Permite trocar o próprio papel (atributo "role") sem reconectar.
    canUpdateOwnMetadata: true,
  });

  return token.toJwt();
}
