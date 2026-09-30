export type Role = 'presenter' | 'viewer';

export interface TokenResponse {
  token: string;
  url: string;
}

export async function fetchToken(room: string, name: string, role: Role): Promise<TokenResponse> {
  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, name, role }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Falha ao obter token (HTTP ${res.status})`);
  }
  return body as TokenResponse;
}
