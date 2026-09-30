import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type ErrorRequestHandler } from 'express';
import { cleanup, findUpload, listMessages, postMessage, saveUpload } from './chat.js';
import { config } from './config.js';
import { listFriends, touchPerson } from './friends.js';
import { HttpError, authenticate } from './livekit.js';
import { createToken, isValidRoomName, type Role } from './token.js';

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/token', async (req, res) => {
  const { room, name, role } = req.body ?? {};

  if (typeof room !== 'string' || !isValidRoomName(room)) {
    res.status(400).json({ error: 'Nome de sala inválido (use letras, números, "-" ou "_").' });
    return;
  }
  if (role !== 'presenter' && role !== 'viewer') {
    res.status(400).json({ error: 'Papel inválido: use "presenter" ou "viewer".' });
    return;
  }

  const displayName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 64) : 'Anônimo';
  const identity = `${role}-${randomUUID()}`;
  const token = await createToken(room, identity, displayName, role as Role);
  touchPerson(displayName, room);

  res.json({ token, url: config.livekitUrl });
});

// ---- Chat (histórico persistente) ----

const roomParam = (value: string | string[] | undefined): string => {
  const room = String(value);
  if (!isValidRoomName(room)) throw new HttpError(400, 'Sala inválida.');
  return room;
};

app.get('/api/rooms/:room/messages', async (req, res) => {
  const room = roomParam(req.params.room);
  await authenticate(req.headers.authorization, room);
  res.json({ messages: listMessages(room) });
});

app.post('/api/rooms/:room/messages', async (req, res) => {
  const caller = await authenticate(req.headers.authorization, roomParam(req.params.room));
  const message = await postMessage(caller, req.body?.text, req.body?.attachmentIds);
  res.status(201).json({ message });
});

app.post(
  '/api/rooms/:room/uploads',
  express.raw({ type: () => true, limit: `${config.maxUploadMb}mb` }),
  async (req, res) => {
    const caller = await authenticate(req.headers.authorization, roomParam(req.params.room));
    res.status(201).json({ attachment: saveUpload(caller, req.body) });
  },
);

// Sem autenticação: <img> não envia headers. Os ids são UUIDs aleatórios.
app.get('/api/uploads/:id', (req, res) => {
  const upload = findUpload(req.params.id);
  if (!upload || !existsSync(upload.file)) {
    res.status(404).json({ error: 'Imagem não encontrada (pode ter expirado).' });
    return;
  }
  res.set({
    'Content-Type': upload.mime,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  // O caminho é montado pelo servidor (UUID validado); DATA_DIR pode ter pastas com ponto.
  res.sendFile(upload.file, { dotfiles: 'allow' });
});

// ---- Amigos ----

app.get('/api/friends', async (_req, res) => {
  res.json(await listFriends());
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Em produção, serve o frontend já compilado.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile('index.html', { root: webDist });
  });
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: `Arquivo grande demais (máx. ${config.maxUploadMb} MB).` });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno.' });
};
app.use(errorHandler);

cleanup();
setInterval(cleanup, 6 * 60 * 60 * 1000).unref();
// Mantém o "visto por último" em dia enquanto as pessoas continuam conectadas.
setInterval(() => listFriends().catch(() => {}), 60 * 1000).unref();

app.listen(config.port, config.host, () => {
  console.log(`Servidor ouvindo em http://${config.host}:${config.port}`);
});
