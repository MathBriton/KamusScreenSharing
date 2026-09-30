import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
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

  res.json({ token, url: config.livekitUrl });
});

// Em produção, serve o frontend já compilado.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile('index.html', { root: webDist });
  });
}

app.listen(config.port, config.host, () => {
  console.log(`Servidor ouvindo em http://${config.host}:${config.port}`);
});
