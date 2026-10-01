import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './livekit.js';

export interface PublicUser {
  id: string;
  name: string;
}

interface UserRow {
  id: string;
  name: string;
  name_key: string;
  pin_hash: string;
  last_seen: number;
  last_room: string | null;
}

const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

/** Nome sem acentos e sem diferenciar maiúsculas: "Júlia" e "julia" são o mesmo perfil. */
export function nameKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleLowerCase('pt-BR');
}

function validName(input: unknown): string {
  const name = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 32) throw new HttpError(400, 'O nome precisa ter de 2 a 32 caracteres.');
  if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) {
    throw new HttpError(400, 'Use só letras, números, espaço, ponto, hífen ou sublinhado no nome.');
  }
  return name;
}

function validPin(input: unknown): string {
  const pin = typeof input === 'string' ? input : '';
  if (!/^\d{4,6}$/.test(pin)) throw new HttpError(400, 'O PIN precisa ter de 4 a 6 números.');
  return pin;
}

function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pin, salt, 32).toString('hex')}`;
}

function pinMatches(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(pin, Buffer.from(salt, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const toPublic = (u: Pick<UserRow, 'id' | 'name'>): PublicUser => ({ id: u.id, name: u.name });

function findByName(name: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE name_key = ?').get(nameKey(name)) as UserRow | undefined;
}

export function findUser(id: string): PublicUser | null {
  const row = db.prepare('SELECT id, name FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? toPublic(row) : null;
}

// ---- Bloqueio contra tentativa e erro de PIN (em memória) ----

const failures = new Map<string, { count: number; until: number }>();

function checkLock(key: string) {
  const f = failures.get(key);
  if (f && f.until > Date.now()) {
    const minutes = Math.ceil((f.until - Date.now()) / 60000);
    throw new HttpError(429, `Muitas tentativas. Tente de novo em ${minutes} min.`);
  }
}

function registerFailure(key: string) {
  const f = failures.get(key) ?? { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILS) {
    f.count = 0;
    f.until = Date.now() + LOCK_MS;
  }
  failures.set(key, f);
}

// ---- Sessões ----

function createSession(userId: string): string {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_used) VALUES (?, ?, ?, ?)').run(
    sha256(token),
    userId,
    now,
    now,
  );
  return token;
}

/** Perfil dono do token (header "Authorization: Bearer ..."). */
export function userFromToken(token: string | undefined): PublicUser | null {
  if (!token) return null;
  const row = db
    .prepare('SELECT u.id, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?')
    .get(sha256(token)) as UserRow | undefined;
  return row ? toPublic(row) : null;
}

export function requireUser(authorization: string | undefined): PublicUser {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  const user = userFromToken(token);
  if (!user) throw new HttpError(401, 'Entre com seu nome e PIN.');
  return user;
}

// ---- Entrar / criar perfil ----

export function nameExists(name: unknown): boolean {
  return !!findByName(validName(name));
}

export function register(nameInput: unknown, pinInput: unknown): { token: string; user: PublicUser } {
  const name = validName(nameInput);
  const pin = validPin(pinInput);
  if (findByName(name)) throw new HttpError(409, 'Esse nome já tem perfil. Entre com o PIN dele.');
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    'INSERT INTO users (id, name, name_key, pin_hash, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, name, nameKey(name), hashPin(pin), now, now);
  return { token: createSession(id), user: { id, name } };
}

export function login(nameInput: unknown, pinInput: unknown): { token: string; user: PublicUser } {
  const name = validName(nameInput);
  const pin = validPin(pinInput);
  const key = nameKey(name);
  checkLock(key);
  const row = findByName(name);
  if (!row) throw new HttpError(404, 'Não existe perfil com esse nome.');
  if (!pinMatches(pin, row.pin_hash)) {
    registerFailure(key);
    throw new HttpError(401, 'PIN incorreto.');
  }
  failures.delete(key);
  return { token: createSession(row.id), user: toPublic(row) };
}

export function logout(authorization: string | undefined): void {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function rename(user: PublicUser, nameInput: unknown): PublicUser {
  const name = validName(nameInput);
  const existing = findByName(name);
  if (existing && existing.id !== user.id) throw new HttpError(409, 'Esse nome já está em uso.');
  db.prepare('UPDATE users SET name = ?, name_key = ? WHERE id = ?').run(name, nameKey(name), user.id);
  return { id: user.id, name };
}

export function changePin(user: PublicUser, currentInput: unknown, nextInput: unknown): void {
  const current = validPin(currentInput);
  const next = validPin(nextInput);
  const key = nameKey(user.name);
  checkLock(key);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as unknown as UserRow;
  if (!pinMatches(current, row.pin_hash)) {
    registerFailure(key);
    throw new HttpError(401, 'PIN atual incorreto.');
  }
  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(next), user.id);
}

export function touchUser(id: string, room: string | null, at = Date.now()): void {
  if (room) db.prepare('UPDATE users SET last_seen = ?, last_room = ? WHERE id = ?').run(at, room, id);
  else db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(at, id);
}

export interface UserSummary extends PublicUser {
  lastSeen: number;
  lastRoom: string | null;
}

export function listUsers(): UserSummary[] {
  return (db.prepare('SELECT id, name, last_seen, last_room FROM users ORDER BY name').all() as unknown as UserRow[]).map(
    (u) => ({ id: u.id, name: u.name, lastSeen: u.last_seen, lastRoom: u.last_room }),
  );
}
