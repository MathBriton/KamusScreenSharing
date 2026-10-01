import { DataPacket_Kind, RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';
import { config } from './config.js';

export const roomService = new RoomServiceClient(config.livekitApiUrl, config.livekitApiKey, config.livekitApiSecret);

const verifier = new TokenVerifier(config.livekitApiKey, config.livekitApiSecret);

export interface Caller {
  room: string;
  identity: string;
  name: string;
  /** Perfil (nome + PIN) de quem está conectado. */
  userId: string | null;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Autentica pelo próprio token do LiveKit (header Authorization: Bearer ...).
 * Garante que só quem está na sala escreve nela, e com o próprio nome.
 */
export async function authenticate(authorization: string | undefined, room: string): Promise<Caller> {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Token ausente.');
  let claims;
  try {
    claims = await verifier.verify(token);
  } catch {
    throw new HttpError(401, 'Token inválido ou expirado.');
  }
  if (!claims.sub || claims.video?.room !== room) throw new HttpError(403, 'Token não é desta sala.');
  return { room, identity: claims.sub, name: claims.name || 'Anônimo', userId: claims.attributes?.userId ?? null };
}

/** Envia um evento para todos na sala (se a sala estiver vazia, não há para quem enviar). */
export async function broadcast(room: string, topic: string, payload: unknown): Promise<void> {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  try {
    await roomService.sendData(room, data, DataPacket_Kind.RELIABLE, { topic });
  } catch (err) {
    console.warn(`Falha ao enviar "${topic}" para a sala ${room}:`, err instanceof Error ? err.message : err);
  }
}
