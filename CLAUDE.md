# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Este arquivo é a **especificação do projeto**: o que ele é, o que já existe e como trabalhar nele.
> O contexto da sessão mais recente (decisões, pendências, armadilhas) fica em **MEMORY.md**,
> importado abaixo. Codex e outros agentes chegam aqui pelo `AGENTS.md`.

@MEMORY.md

## O que é

**Kamus Screen Sharing** é um compartilhamento de tela **1-para-muitos no navegador**, para um grupo
pequeno de amigos. A voz fica no Discord; o app cuida só de **tela + chat**. Não é um produto público:
não há e-mail nem senha; cada pessoa tem um **perfil leve (nome + PIN de 4–6 dígitos)**, criado na
primeira entrada. Quem tem o link da sala e um perfil entra.

Princípios que guiam as decisões:

- **Simples de hospedar**: uma VPS com Docker Compose (Caddy + LiveKit com TURN embutido + app).
- **Nada para instalar**: tudo no navegador; celular só assiste (limitação dos navegadores móveis).
- **Interface em português (pt-BR)**, inclusive mensagens de erro da API e comentários do código.
- **Design**: dark industrial minimalista com toque de gaming UI, uma única cor de destaque (verde-limão)
  e vermelho só para LIVE/parar/sair. A especificação visual e os tokens ficam em **`web/src/UI/`**
  (`README.md`, `TOKENS.md` e o protótipo em `referencias/`). A **logo** fica em `web/src/logo/`
  (`Logo.tsx`; o original enviado é `kamus-logo-original.png`, de fundo branco e texto preto, e as versões
  usadas na barra, `kamus-logo.png`/`kamus-mark.png`, têm fundo transparente e texto claro).

## Funcionalidades implementadas

| Área | O que faz |
| --- | --- |
| Salas | Links fixos `/s/<sala>` (nome livre normalizado: "Amigos da Firma" → `amigos-da-firma`) ou código aleatório; salas recentes na home; links antigos `?sala=` convertidos. |
| Transmissão | Via SFU (LiveKit). Qualquer participante clica em **Transmitir**; **várias transmissões simultâneas**. **Compartilhar tela** troca a janela/tela sem derrubar a transmissão (`replaceTrack`). Qualidade (Texto 1080p15, Equilibrado 1080p30, Jogo 720p60, Máxima 1080p60) em **Configurações**, trocada ao vivo. Áudio da transmissão opcional e desligado por padrão (evita eco com o Discord). |
| Sala (layout) | Barra superior (sala, nº de pessoas, Amigos, LIVE + duração da sessão, código com copiar, métricas: ping, conexão, resolução, FPS, bitrate), palco, sidebar (participantes + chat) e barra inferior de controles (Grade/Foco, Mic e Áudio só visuais, Compartilhar tela, Transmitir, Alternar tela, Tela cheia, Configurações, Sair da sala). |
| Palco | **Grade** adaptável (1×1, 2×1, 2×2, 3×2, 3×3…) ou **Foco** (selecionada grande + miniaturas). Cards com avatar, nome, LIVE, "Transmitindo", microfone (visual) e menu; borda verde na selecionada. **Zoom** por vídeo (roda, pinça, arrastar, `+ - 0`); tela cheia (`F`); picture-in-picture (`P`); `G` alterna Grade/Foco; `1–9` escolhe a transmissão. |
| Chat | **Persistente** (SQLite, retenção de 90 dias): histórico para quem chega depois; links clicáveis; **colar/arrastar imagens** e **rabiscar no print** antes de enviar (seta, círculo, retângulo, traço); prévia de links diretos de imagem/GIF; abas **Chat / Imagens / Links**; lightbox. **@menções** com autocompletar, destaque e aviso (toast + notificação do navegador); **responder citando**; **fixar mensagens** (barra no topo; fixadas não expiram); **busca** no histórico inteiro (filtros Links/Imagens, salto até a mensagem); **"fulano está digitando…"**. |
| Presença | Participantes com transmitindo/parado, `1080p · 60 FPS`, microfone (visual) e qualidade da conexão; avisos de entrada/saída/início/fim de transmissão (toast + linha no chat). |
| Perfil | **Nome + PIN** (`web/src/account/`): o nome é único sem diferenciar acentos/maiúsculas; o PIN fica com scrypt; 5 erros bloqueiam o nome por 5 min. Sessão em `localStorage` (`kamus:session`). Menu **Perfil**: trocar nome, trocar PIN, sair da sala, sair da conta. |
| Topbar | Na home: `web/src/layout/TopBar.tsx`. Na sala: `web/src/room/RoomTopBar.tsx` (Salas/Amigos só com ícone abaixo de 2xl; código e métricas a partir de xl). Menus **Salas** (ativas agora com quem está/ao vivo, criar/entrar, recentes), **Amigos** (online com sala/ao vivo/Entrar, offline com "visto há…", botão de mensagem com não lidas), **sininho** e **Perfil**. Novos menus entram nessas barras. |
| Mensagens privadas | Painel lateral (`DmPanel`) aberto pelo menu Amigos ou pelo sininho; histórico (últimas 200), entrega em tempo real por **SSE** (`/api/me/events`), contador de não lidas. |
| Sininho | Notificações persistentes: **mensagem privada**, **menção** em qualquer sala e **amigo ficou ao vivo** (no máx. 1 aviso a cada 10 min por pessoa+sala; não avisa quem já está na sala). Toast + notificação do navegador com a aba em segundo plano; clicar abre a conversa ou entra na sala. |
| Celular | Detecta navegador móvel e só permite assistir, explicando o motivo. |

## Comandos

```bash
npm install
cp .env.example .env

npm run livekit:local   # LiveKit em modo dev sem Docker (baixa o binário em .cache/)
npm run livekit         # ...ou via Docker Compose
npm run dev             # API :3001 + Vite :5173 (proxy /api → 127.0.0.1:3001); scripts/dev.mjs, roda no Windows também

npm run typecheck       # tsc nos dois workspaces
npm run build           # server/dist + web/dist
npm start               # produção local: API + frontend em :3001

npm run test:e2e        # Playwright: sobe LiveKit (:7880) e o app (:3100) sozinho
sh scripts/install-docker.sh           # instala Docker + Compose num Linux (VPS)
npx playwright test e2e/chat.spec.ts   # um arquivo
npx playwright test -g "zoom"          # por nome
```

Em ambientes sem `npx playwright install` (ex.: sandbox com Chromium já instalado), aponte o navegador:
`PW_CHROMIUM_PATH=/caminho/do/chromium npm run test:e2e`.

## Arquitetura

```
navegador ──POST /api/token──▶ server (Express) ──▶ JWT do LiveKit (papel no atributo "role")
    │  ──REST /api/rooms/:sala/{messages,uploads}──▶ server ──▶ SQLite + disco
    │                                                  └──sendData(topic "chat")──▶ LiveKit ──▶ todos na sala
    └──WebRTC + sinalização (wss /rtc)──▶ LiveKit (SFU) ◀── transmissões de tela
```

- **server/** (Node 22, Express 5, TypeScript, ESM)
  - `index.ts`: rotas. `token.ts`: emissão do JWT. `livekit.ts`: `RoomServiceClient`, autenticação das
    rotas pelo **próprio token do LiveKit** (`Authorization: Bearer`) e `broadcast()`.
  - `users.ts`: perfis (nome + PIN, scrypt, bloqueio por tentativas) e sessões (hash sha256 do token).
    `events.ts`: SSE por usuário. `notifications.ts`: sininho. `dms.ts`: mensagens privadas.
  - `chat.ts`: mensagens, uploads, retenção, avisos de menção. `images.ts`: detecção de formato pelos bytes (PNG/JPEG/GIF/WebP;
    SVG proibido). `friends.ts`: presença (participantes
    do LiveKit com o atributo `userId`) + salas ativas. `db.ts`: schema SQLite
    (`node:sqlite`). `config.ts`: variáveis de ambiente.
- **web/** (React 19, Vite, Tailwind v4, shadcn/ui, `livekit-client`)
  - `App.tsx`: roteamento manual (`/s/<sala>`) dentro do `AccountProvider`; sem sessão mostra o login.
  - `account/`: `AccountContext` (sessão, SSE, notificações, conversas), `LoginForm`, `DmPanel`.
  - `room/`: `RoomView` (conexão, transmissão, seleção, atalhos), `RoomTopBar`, `ControlBar`,
    `ParticipantsPanel`, `useMetrics` (ping, estatísticas WebRTC, cronômetros).
  - `stage/`: `Stage` (grade/foco), `StreamCard` (card com cabeçalho, menu e zoom), `useZoom`,
    `useScreenShares`. `chat/`: chat persistente. `layout/`: topbar da home e menus
    (Salas, Amigos, sininho, Perfil).
    `components/ui/`: componentes shadcn. `UI/`: especificação visual. `index.css`: tokens do tema (ver `web/src/UI/TOKENS.md`).
- **deploy/**: Compose de produção, Caddyfile, template do `livekit.yaml`, `setup.sh`.
- **e2e/**: suíte Playwright. **.github/workflows/ci.yml**: CI em todo push + deploy opcional na `main`.

### API

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| POST | `/api/auth/check` | — | `{name}` → `{exists}` |
| POST | `/api/auth/register` · `/api/auth/login` | — | `{name, pin}` → `{token, user}` (sessão) |
| POST | `/api/auth/logout` | sessão | encerra a sessão |
| GET / PATCH | `/api/me` | sessão | perfil / `{name}` para trocar o nome |
| POST | `/api/me/pin` | sessão | `{current, pin}` |
| GET | `/api/me/events?token=` | sessão (na query: o `EventSource` não manda cabeçalho) | SSE: `notification`, `notifications-read`, `dm` |
| GET · POST | `/api/me/notifications` · `/api/me/notifications/read` | sessão | sininho; marcar lidas com `{ids?}` ou `{dmFrom?}` |
| GET | `/api/me/conversations` | sessão | `[{peerId, last, unread}]` |
| GET · POST | `/api/me/dm/:peerId` (e `/read`) | sessão | histórico / enviar `{text}` / marcar lida |
| POST | `/api/token` | sessão | `{room}` → `{token, url}` (identidade `userId:aleatório`, nome do perfil) |
| GET | `/api/rooms/active` | sessão | salas com gente: `[{room, people:[{name, live}]}]` |
| POST | `/api/rooms/:room/live` | token da sala | avisa os amigos (sininho) que começou a transmitir |
| GET | `/api/rooms/:room/messages` | token da sala | últimas 500 mensagens |
| POST | `/api/rooms/:room/messages` | token da sala | `{text, attachmentIds, replyTo?}`; grava e repassa pelo LiveKit |
| POST | `/api/rooms/:room/uploads` | token da sala | corpo binário da imagem (máx. `MAX_UPLOAD_MB`) |
| GET | `/api/uploads/:id` | — (UUID) | serve a imagem com `nosniff` + CSP `sandbox` |
| POST | `/api/rooms/:room/messages/:id/pin` | token da sala | `{pinned}`; fixa/desafixa e repassa (`type: "pin"`) |
| GET | `/api/rooms/:room/pins` | token da sala | mensagens fixadas (qualquer idade) |
| GET | `/api/rooms/:room/search` | token da sala | `?q=&kind=all\|links\|images` → até 50 resultados |
| GET | `/api/rooms/:room/info` | token da sala | `{createdAt}` (duração da sessão) |
| GET | `/api/friends` | sessão | `{friends}` (sem a própria pessoa) |

"Sessão" = `Authorization: Bearer <token da sessão>` (de `/api/auth/*`); "token da sala" = o JWT do
LiveKit.

### Variáveis de ambiente (server)

`LIVEKIT_URL` (URL para o navegador), `LIVEKIT_API_URL` (API HTTP do LiveKit; padrão: derivada de
`LIVEKIT_URL`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `PORT`, `HOST`, `DATA_DIR` (padrão `./data`),
`RETENTION_DAYS` (90), `MAX_UPLOAD_MB` (10).

## Convenções

- Texto de interface, erros e comentários em **português**; nomes de código em inglês.
- Componentes shadcn ficam em `web/src/components/ui/` e podem ser editados. Para adicionar:
  `cd web && npx shadcn@latest add <componente>` (se o registro estiver bloqueado, copie de
  `github.com/shadcn-ui/ui/.../registry/new-york-v4/ui/` e troque o import `"cn"` por `"@/lib/utils"`).
- Estado compartilhado da sala via **LiveKit** (atributos, text/data streams); estado persistente via
  **API + SQLite**. Preferências do usuário em `localStorage` sempre dentro de `try/catch`.
- Permissões do token: todos podem publicar **só** `SCREEN_SHARE`/`SCREEN_SHARE_AUDIO`. Ao transmitir,
  o participante publica os atributos `role=presenter` e `fps=<preset>`; ao parar, volta a `viewer`.
- Visual: siga `web/src/UI/TOKENS.md` (sem gradientes, blur ou neon; verde só para estado ativo; vermelho só
  para LIVE/parar/sair; métricas e códigos em fonte mono).
- Toda mudança de comportamento deve vir com teste em `e2e/` e passar em `npm run typecheck` e
  `npm run test:e2e`.
- Ao terminar uma sessão de trabalho, **atualize o MEMORY.md**.

## Fora de escopo (por decisão)

Voz/microfone de verdade (usa-se o Discord; os botões Mic/Áudio são só visuais, reservando o lugar),
controle de volume do espectador, contas com e-mail/senha/OAuth (o perfil é só nome + PIN),
Kubernetes, controle remoto (exigiria app nativo).
