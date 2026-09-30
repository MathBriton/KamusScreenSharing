# Kamus Screen Sharing

Compartilhamento de tela **1-para-muitos** direto no navegador. Quem apresenta cria uma sala e
compartilha a tela; os espectadores entram pelo link, sem instalar nada.

A mídia passa por um **SFU** ([LiveKit](https://livekit.io)): o apresentador envia um único fluxo
e o servidor o distribui para todos os espectadores. Assim o número de espectadores não fica
limitado pelo upload de quem apresenta.

## Arquitetura

```
┌──────────────┐  POST /api/token   ┌──────────────────┐
│  web (React) │ ─────────────────▶ │ server (Express) │  gera tokens JWT do LiveKit
│    Vite      │                    └──────────────────┘  (apresentador pode publicar;
└──────┬───────┘                                           espectador só assiste)
       │ WebRTC + sinalização (ws)
       ▼
┌──────────────────┐
│  LiveKit (SFU)   │  recebe a tela do apresentador e repassa aos espectadores
└──────────────────┘
```

| Pasta      | Conteúdo                                                       |
| ---------- | -------------------------------------------------------------- |
| `server/`  | API em Node + Express + TypeScript (`livekit-server-sdk`)      |
| `web/`     | Frontend em React + Vite + TypeScript (`livekit-client`)       |

## Pré-requisitos

- Node.js 22 ou superior
- Docker, para rodar o LiveKit localmente, **ou** o binário `livekit-server`
  ([instalação](https://docs.livekit.io/home/self-hosting/local/))

## Como rodar em desenvolvimento

```bash
npm install
cp .env.example .env

# 1. Suba o LiveKit em modo dev (chaves devkey/secret)
npm run livekit            # ou: livekit-server --dev

# 2. Em outro terminal, suba a API e o frontend
npm run dev
```

Abra http://localhost:5173, clique em **Criar sala e compartilhar** e depois em
**Compartilhar tela**. Use **Copiar link** e abra o link em outra aba ou em outro navegador
para assistir.

## Build de produção

```bash
npm run build
npm start                  # serve API + frontend em http://localhost:3001
```

Em produção, configure `LIVEKIT_URL`, `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` apontando para
o seu servidor LiveKit (auto-hospedado ou LiveKit Cloud). Use `wss://` e HTTPS:
`getDisplayMedia` só funciona em contexto seguro (ou em `localhost`).

## Scripts

| Comando             | O que faz                                         |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | API (porta 3001) e frontend (porta 5173) com hot reload |
| `npm run build`     | Compila servidor e frontend                       |
| `npm start`         | Roda o build de produção                          |
| `npm run typecheck` | Checagem de tipos em todos os pacotes             |
| `npm run livekit`   | Sobe o LiveKit via Docker Compose                 |

## Próximos passos

- [ ] Autenticação: hoje qualquer pessoa pode pedir um token de apresentador
- [ ] Chat da sala (via data channel do LiveKit)
- [ ] Lista de espectadores conectados
- [ ] Deploy (LiveKit Cloud ou auto-hospedado com TURN)
