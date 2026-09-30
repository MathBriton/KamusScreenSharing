# Kamus Screen Sharing

Compartilhamento de tela **1-para-muitos** direto no navegador, para uso entre amigos. Quem
apresenta cria uma sala e compartilha a tela; os espectadores entram pelo link, sem instalar
nada. A sala tem chat e lista de quem está presente.

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

Para colocar no ar numa VPS (Docker + Caddy + LiveKit com TURN embutido), siga o
[guia de deploy](deploy/README.md). É preciso HTTPS: `getDisplayMedia` só funciona em
contexto seguro (ou em `localhost`).

## Scripts

| Comando             | O que faz                                         |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | API (porta 3001) e frontend (porta 5173) com hot reload |
| `npm run build`     | Compila servidor e frontend                       |
| `npm start`         | Roda o build de produção                          |
| `npm run typecheck` | Checagem de tipos em todos os pacotes             |
| `npm run livekit`   | Sobe o LiveKit via Docker Compose                 |

## Observações

- Não há autenticação: quem tem o link da sala entra. O projeto é pensado para um grupo
  pequeno de amigos, e o código da sala (aleatório) funciona como "senha".
- O chat não guarda histórico: quem entra depois só vê as mensagens a partir da entrada.
