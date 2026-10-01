import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type ErrorRequestHandler } from 'express';
import { cleanup, findUpload, listMessages, listPinned, postMessage, saveUpload, searchMessages, setPinned } from './chat.js';
import { config } from './config.js';
import { conversation, conversations, markConversationRead, sendDm } from './dms.js';
import { subscribe } from './events.js';
import { listActiveRooms, listFriends, usersInRoom } from './friends.js';
import { HttpError, authenticate, roomService } from './livekit.js';
import { listNotifications, markNotificationsRead, notify, shouldNotifyLive } from './notifications.js';
import { createToken, isValidRoomName } from './token.js';
import {
  changePin,
  listUsers,
  login,
  logout,
  nameExists,
  register,
  rename,
  requireUser,
  touchUser,
  userFromToken,
} from './users.js';

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ---- Perfil (nome + PIN) ----

app.post('/api/auth/check', (req, res) => {
  res.json({ exists: nameExists(req.body?.name) });
});

app.post('/api/auth/register', (req, res) => {
  res.status(201).json(register(req.body?.name, req.body?.pin));
});

app.post('/api/auth/login', (req, res) => {
  res.json(login(req.body?.name, req.body?.pin));
});

app.post('/api/auth/logout', (req, res) => {
  logout(req.headers.authorization);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: requireUser(req.headers.authorization) });
});

app.patch('/api/me', (req, res) => {
  const user = requireUser(req.headers.authorization);
  res.json({ user: rename(user, req.body?.name) });
});

app.post('/api/me/pin', (req, res) => {
  const user = requireUser(req.headers.authorization);
  changePin(user, req.body?.currentPin, req.body?.newPin);
  res.json({ ok: true });
});

// Eventos em tempo real (mensagens privadas e notificações). EventSource não envia
// headers, então o token vem na query string (sempre sob HTTPS em produção).
app.get('/api/me/events', (req, res) => {
  const user = userFromToken(typeof req.query.token === 'string' ? req.query.token : undefined);
  if (!user) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return;
  }
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const unsubscribe = subscribe(user.id, res);
  req.on('close', unsubscribe);
});

app.get('/api/me/notifications', (req, res) => {
  const user = requireUser(req.headers.authorization);
  res.json({ notifications: listNotifications(user.id) });
});

app.post('/api/me/notifications/read', (req, res) => {
  const user = requireUser(req.headers.authorization);
  markNotificationsRead(user.id, { ids: req.body?.ids });
  res.json({ ok: true });
});

// ---- Mensagens privadas ----

app.get('/api/me/conversations', (req, res) => {
  const user = requireUser(req.headers.authorization);
  res.json({ conversations: conversations(user) });
});

app.get('/api/me/dm/:peerId', (req, res) => {
  const user = requireUser(req.headers.authorization);
  res.json({ messages: conversation(user, String(req.params.peerId)) });
});

app.post('/api/me/dm/:peerId', (req, res) => {
  const user = requireUser(req.headers.authorization);
  res.status(201).json({ message: sendDm(user, String(req.params.peerId), req.body?.text) });
});

app.post('/api/me/dm/:peerId/read', (req, res) => {
  const user = requireUser(req.headers.authorization);
  markConversationRead(user, String(req.params.peerId));
  res.json({ ok: true });
});

// ---- Salas ----

app.post('/api/token', async (req, res) => {
  const user = requireUser(req.headers.authorization);
  const { room } = req.body ?? {};
  if (typeof room !== 'string' || !isValidRoomName(room)) {
    res.status(400).json({ error: 'Nome de sala inválido (use letras, números, "-" ou "_").' });
    return;
  }
  // Identidade única por conexão (a mesma pessoa pode abrir duas abas).
  const identity = `${user.id}:${randomUUID().slice(0, 8)}`;
  const token = await createToken(room, identity, user.name, 'viewer', user.id);
  touchUser(user.id, room);
  res.json({ token, url: config.livekitUrl });
});

app.get('/api/rooms/active', async (req, res) => {
  requireUser(req.headers.authorization);
  res.json({ rooms: await listActiveRooms() });
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
  const message = await postMessage(caller, req.body?.text, req.body?.attachmentIds, req.body?.replyTo);
  res.status(201).json({ message });
});

app.post('/api/rooms/:room/messages/:id/pin', async (req, res) => {
  const caller = await authenticate(req.headers.authorization, roomParam(req.params.room));
  res.json({ message: await setPinned(caller, String(req.params.id), req.body?.pinned) });
});

app.get('/api/rooms/:room/pins', async (req, res) => {
  const room = roomParam(req.params.room);
  await authenticate(req.headers.authorization, room);
  res.json({ messages: listPinned(room) });
});

app.get('/api/rooms/:room/search', async (req, res) => {
  const room = roomParam(req.params.room);
  await authenticate(req.headers.authorization, room);
  res.json({ messages: searchMessages(room, req.query.q, req.query.kind) });
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

// Hora de criação da sala no LiveKit (duração da sessão na barra superior).
app.get('/api/rooms/:room/info', async (req, res) => {
  const room = roomParam(req.params.room);
  await authenticate(req.headers.authorization, room);
  const [info] = await roomService.listRooms([room]);
  res.json({ createdAt: info ? Number(info.creationTime) * 1000 : null });
});

// ---- Amigos ----

app.get('/api/friends', async (req, res) => {
  const user = requireUser(req.headers.authorization);
  res.json({ friends: (await listFriends()).filter((f) => f.id !== user.id) });
});

// Quem começou a transmitir avisa os amigos (menos quem já está na sala).
app.post('/api/rooms/:room/live', async (req, res) => {
  const caller = await authenticate(req.headers.authorization, roomParam(req.params.room));
  if (caller.userId && shouldNotifyLive(caller.userId, caller.room)) {
    const present = await usersInRoom(caller.room);
    for (const u of listUsers()) {
      if (u.id === caller.userId || present.has(u.id)) continue;
      notify(u.id, 'live', { room: caller.room, fromId: caller.userId, fromName: caller.name });
    }
  }
  res.json({ ok: true });
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
