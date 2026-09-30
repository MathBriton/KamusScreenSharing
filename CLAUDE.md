# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Este arquivo é a **especificação do projeto**: o que ele é, o que já existe e como trabalhar nele.
> O contexto da sessão mais recente (decisões, pendências, armadilhas) fica em **MEMORY.md**,
> importado abaixo. Codex e outros agentes chegam aqui pelo `AGENTS.md`.

@MEMORY.md

## O que é

**Kamus Screen Sharing** é um compartilhamento de tela **1-para-muitos no navegador**, para um grupo
pequeno de amigos. A voz fica no Discord; o app cuida só de **tela + chat**. Não é um produto público:
não há contas nem autenticação. Quem tem o link da sala entra.

Princípios que guiam as decisões:

- **Simples de hospedar**: uma VPS com Docker Compose (Caddy + LiveKit com TURN embutido + app).
- **Nada para instalar**: tudo no navegador; celular só assiste (limitação dos navegadores móveis).
- **Interface em português (pt-BR)**, inclusive mensagens de erro da API e comentários do código.

## Funcionalidades implementadas

| Área | O que faz |
| --- | --- |
| Salas | Links fixos `/s/<sala>` (nome livre normalizado: "Amigos da Firma" → `amigos-da-firma`) ou código aleatório; salas recentes na home; links antigos `?sala=` convertidos. |
| Transmissão | Via SFU (LiveKit). Qualquer participante pode apresentar; **várias transmissões simultâneas**. Qualidade escolhida por quem apresenta (Texto 1080p15, Equilibrado 1080p30, Jogo 720p60, Máxima 1080p60), trocada **ao vivo**. Áudio da transmissão opcional e **desligado por padrão** (evita eco com o Discord). |
| Palco | Modo **Foco** (uma grande + miniaturas) ou **Lado a lado**; seletor de transmissão; **zoom** por vídeo (roda, pinça, arrastar, botões, teclas `+ - 0`); tela cheia (`F`, duplo clique); picture-in-picture (`P`). |
| Chat | **Persistente** (SQLite, retenção de 90 dias): histórico para quem chega depois; links clicáveis; **colar/arrastar imagens**; prévia de links diretos de imagem/GIF; abas **Chat / Imagens / Links**; lightbox. |
| Presença | Lista de participantes com "ao vivo"; avisos de entrada/saída/início/fim de transmissão (toast + linha no chat). |
| Topbar | Barra fixa com o menu **Amigos**: quem está online (sala, ao vivo, botão Entrar) e "vistos recentemente". Novos menus entram em `web/src/layout/TopBar.tsx`. |
| Celular | Detecta navegador móvel e só permite assistir, explicando o motivo. |

## Comandos

```bash
npm install
cp .env.example .env

npm run livekit:local   # LiveKit em modo dev sem Docker (baixa o binário em .cache/)
npm run livekit         # ...ou via Docker Compose
npm run dev             # API :3001 + Vite :5173 (proxy /api → :3001)

npm run typecheck       # tsc nos dois workspaces
npm run build           # server/dist + web/dist
npm start               # produção local: API + frontend em :3001

npm run test:e2e        # Playwright: sobe LiveKit (:7880) e o app (:3100) sozinho
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
  - `chat.ts`: mensagens, uploads, retenção. `images.ts`: detecção de formato pelos bytes (PNG/JPEG/GIF/WebP;
    SVG proibido). `friends.ts`: presença (LiveKit) + "vistos" (tabela `people`). `db.ts`: schema SQLite
    (`node:sqlite`). `config.ts`: variáveis de ambiente.
- **web/** (React 19, Vite, Tailwind v4, shadcn/ui, `livekit-client`)
  - `App.tsx`: roteamento manual (`/s/<sala>`, `?apresentar`), `TopBar` + página.
  - `RoomView.tsx`: conexão, papel, qualidade, cabeçalho da sala. `stage/`: palco, tiles, zoom.
    `chat/`: chat persistente. `layout/`: topbar e Amigos. `components/ui/`: componentes shadcn.
- **deploy/**: Compose de produção, Caddyfile, template do `livekit.yaml`, `setup.sh`.
- **e2e/**: suíte Playwright. **.github/workflows/ci.yml**: CI em todo push + deploy opcional na `main`.

### API

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| POST | `/api/token` | — | `{room, name, role}` → `{token, url}` |
| GET | `/api/rooms/:room/messages` | token da sala | últimas 500 mensagens |
| POST | `/api/rooms/:room/messages` | token da sala | `{text, attachmentIds}`; grava e repassa pelo LiveKit |
| POST | `/api/rooms/:room/uploads` | token da sala | corpo binário da imagem (máx. `MAX_UPLOAD_MB`) |
| GET | `/api/uploads/:id` | — (UUID) | serve a imagem com `nosniff` + CSP `sandbox` |
| GET | `/api/friends` | — | `{online, recent}` |

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
- Permissões do token: todos podem publicar **só** `SCREEN_SHARE`/`SCREEN_SHARE_AUDIO`.
- Toda mudança de comportamento deve vir com teste em `e2e/` e passar em `npm run typecheck` e
  `npm run test:e2e`.
- Ao terminar uma sessão de trabalho, **atualize o MEMORY.md**.

## Fora de escopo (por decisão)

Voz/microfone (usa-se o Discord), controle de volume do espectador, autenticação/contas,
Kubernetes, controle remoto (exigiria app nativo).
