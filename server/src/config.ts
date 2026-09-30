function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  livekitUrl: required('LIVEKIT_URL', 'ws://localhost:7880'),
  livekitApiKey: required('LIVEKIT_API_KEY', 'devkey'),
  livekitApiSecret: required('LIVEKIT_API_SECRET', 'secret'),
};
