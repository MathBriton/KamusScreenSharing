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
