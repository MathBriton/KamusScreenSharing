import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export const uploadsDir = path.join(config.dataDir, 'uploads');
mkdirSync(uploadsDir, { recursive: true });

export const db = new DatabaseSync(path.join(config.dataDir, 'kamus.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    room       TEXT NOT NULL,
    identity   TEXT NOT NULL,
    author     TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS messages_room_time ON messages (room, created_at);

  -- Imagens coladas no chat. message_id fica nulo entre o upload e o envio da mensagem.
  CREATE TABLE IF NOT EXISTS attachments (
    id         TEXT PRIMARY KEY,
    room       TEXT NOT NULL,
    identity   TEXT NOT NULL,
    message_id TEXT REFERENCES messages (id) ON DELETE CASCADE,
    mime       TEXT NOT NULL,
    size       INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS attachments_message ON attachments (message_id);

  -- "Amigos": quem já usou o servidor, identificado pelo nome (não há contas).
  CREATE TABLE IF NOT EXISTS people (
    name_key  TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    last_seen INTEGER NOT NULL,
    last_room TEXT
  );
`);

// Perfis (nome + PIN), sessões, mensagens privadas e notificações.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    name_key   TEXT NOT NULL UNIQUE,
    pin_hash   TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen  INTEGER NOT NULL,
    last_room  TEXT
  );

  -- Guarda só o hash do token de sessão.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    last_used  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS direct_messages (
    id         TEXT PRIMARY KEY,
    from_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    to_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    read_at    INTEGER
  );
  CREATE INDEX IF NOT EXISTS dm_pair ON direct_messages (from_id, to_id, created_at);
  CREATE INDEX IF NOT EXISTS dm_to ON direct_messages (to_id, read_at);

  CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    read_at    INTEGER
  );
  CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id, created_at);
`);

// Migrações simples: colunas adicionadas depois da primeira versão.
function addColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

addColumn('messages', 'reply_to', 'TEXT');
addColumn('messages', 'pinned_at', 'INTEGER');
addColumn('messages', 'pinned_by', 'TEXT');
db.exec('CREATE INDEX IF NOT EXISTS messages_room_pinned ON messages (room, pinned_at)');
