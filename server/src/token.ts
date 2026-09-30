import { AccessToken } from 'livekit-server-sdk';
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
    // O papel fica visível para os outros participantes (lista de presentes).
    attributes: { role },
  });

  token.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    // Só quem apresenta pode publicar mídia; espectadores apenas assistem.
    canPublish: role === 'presenter',
    canPublishData: true,
  });

  return token.toJwt();
}
