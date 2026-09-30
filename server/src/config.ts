import path from 'node:path';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function positiveNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} precisa ser um número positivo`);
  }
  return value;
}

const livekitUrl = required('LIVEKIT_URL', 'ws://localhost:7880');

export const config = {
  port: Number(process.env.PORT ?? 3001),
  // Em produção fica atrás do Caddy, então escuta só em 127.0.0.1.
  host: process.env.HOST ?? '0.0.0.0',
  /** URL que o navegador usa para conectar no LiveKit. */
  livekitUrl,
  /** URL da API HTTP do LiveKit, usada pelo servidor (enviar mensagens, listar salas). */
  livekitApiUrl: process.env.LIVEKIT_API_URL ?? livekitUrl.replace(/^ws/, 'http'),
  livekitApiKey: required('LIVEKIT_API_KEY', 'devkey'),
  livekitApiSecret: required('LIVEKIT_API_SECRET', 'secret'),
  /** Banco SQLite e imagens enviadas no chat. */
  dataDir: path.resolve(process.env.DATA_DIR ?? 'data'),
  /** Mensagens, imagens e "vistos recentemente" mais antigos que isso são apagados. */
  retentionDays: positiveNumber('RETENTION_DAYS', 90),
  maxUploadMb: positiveNumber('MAX_UPLOAD_MB', 10),
};
