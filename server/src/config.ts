function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  // Em produção fica atrás do Caddy, então escuta só em 127.0.0.1.
  host: process.env.HOST ?? '0.0.0.0',
  livekitUrl: required('LIVEKIT_URL', 'ws://localhost:7880'),
  livekitApiKey: required('LIVEKIT_API_KEY', 'devkey'),
  livekitApiSecret: required('LIVEKIT_API_SECRET', 'secret'),
};
