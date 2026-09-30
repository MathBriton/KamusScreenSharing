# Kamus Screen Sharing

Compartilhamento de tela **1-para-muitos** direto no navegador, para uso entre amigos (a voz
fica no Discord). Quem apresenta cria uma sala e compartilha a tela; os espectadores entram pelo
link, sem instalar nada.

## Recursos

- **Várias telas ao mesmo tempo**: todos podem clicar em **Transmitir**. Visualização em **Grade**
  (adaptável ao número de transmissões) ou **Foco** (uma grande e as outras em miniatura).
  **Compartilhar tela** troca a janela transmitida sem interromper quem assiste.
- **Informações técnicas discretas** na barra superior: LIVE, duração da sessão, código da sala,
  ping, conexão, resolução, FPS e bitrate da transmissão selecionada.
- **Sidebar** com participantes (transmitindo ou não, `1080p · 60 FPS`, conexão) e chat.
- **Qualidade escolhida por quem transmite** (Texto 1080p15, Equilibrado 1080p30, Jogo 720p60,
  Máxima 1080p60), trocada na hora. Áudio da transmissão opcional e desligado por padrão.
- **Para quem assiste**: zoom (roda, pinça, arrastar, `+` `-` `0`), tela cheia (`F`), janela
  flutuante (`P`), `G` alterna Grade/Foco e `1`–`9` escolhe a transmissão.
- **Chat com histórico** (90 dias): links clicáveis, colar/arrastar prints (e **rabiscar** neles
  antes de enviar), prévia de GIFs, abas **Imagens** e **Links**, **@menções** com aviso,
  **responder citando**, **mensagens fixadas**, **busca** no histórico e "fulano está digitando…".
- **Salas fixas** (`/s/amigos`), salas recentes e menu **Amigos** (quem está online e onde).
- **Celular** assiste (navegadores móveis não compartilham tela).

O visual segue a especificação em [`web/src/UI/`](web/src/UI/README.md): dark industrial minimalista, uma única cor
de destaque e vermelho só para LIVE, parar e sair.

A mídia passa por um **SFU** ([LiveKit](https://livekit.io)): o apresentador envia um único fluxo
e o servidor o distribui para todos os espectadores. Assim o número de espectadores não fica
limitado pelo upload de quem apresenta.

## Arquitetura

```
navegador ──POST /api/token──────────────────▶ server (Express): token JWT do LiveKit
    │  ──/api/rooms/:sala/{messages,uploads}──▶ server ──▶ SQLite + imagens em disco
    │                                              └─ repassa a mensagem ─▶ LiveKit ─▶ todos na sala
    └──WebRTC──▶ LiveKit (SFU) ◀── transmissões de tela
```

| Pasta      | Conteúdo |
| ---------- | -------- |
| `server/`  | API em Node 22 + Express + TypeScript (`livekit-server-sdk`, `node:sqlite`) |
| `web/`     | Frontend em React + Vite + TypeScript, UI com [shadcn/ui](https://ui.shadcn.com) + Tailwind v4 (`livekit-client`) |
| `e2e/`     | Testes de ponta a ponta com Playwright |
| `deploy/`  | Produção numa VPS: Docker Compose, Caddy, LiveKit com TURN |

Documentação para quem desenvolve (pessoas e agentes de IA): [`CLAUDE.md`](CLAUDE.md) (especificação),
[`MEMORY.md`](MEMORY.md) (estado atual e decisões) e [`AGENTS.md`](AGENTS.md) (Codex).

## Pré-requisitos

- Node.js 22 ou superior
- Para o LiveKit local: nada além do Node (o script `npm run livekit:local` baixa o binário),
  ou Docker (`npm run livekit`). Para instalar o Docker, veja
  [Instalar o Docker](deploy/README.md#instalar-o-docker).

## Como rodar em desenvolvimento

```bash
npm install
cp .env.example .env

# 1. Suba o LiveKit em modo dev (chaves devkey/secret)
npm run livekit:local      # ou, com Docker: npm run livekit

# 2. Em outro terminal, suba a API e o frontend
npm run dev
```

Abra http://localhost:5173, clique em **Criar sala** (ou dê um nome à sala) e depois em
**Transmitir**. Use **Copiar link** e abra o link em outra aba ou em outro navegador
para assistir.

## Build de produção

```bash
npm run build
npm start                  # serve API + frontend em http://localhost:3001
```

Para colocar no ar numa VPS (Docker + Caddy + LiveKit com TURN embutido), siga o
[guia de deploy](deploy/README.md). É preciso HTTPS: `getDisplayMedia` só funciona em
contexto seguro (ou em `localhost`).

## Componentes de UI

A interface usa [shadcn/ui](https://ui.shadcn.com): os componentes ficam em
`web/src/components/ui/` e podem ser editados à vontade. Para adicionar outro:

```bash
cd web
npx shadcn@latest add dialog
```

O tema (claro/escuro, seguindo o sistema) está nas variáveis CSS de `web/src/index.css`.

## Scripts

| Comando             | O que faz                                         |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | API (porta 3001) e frontend (porta 5173) com hot reload |
| `npm run build`     | Compila servidor e frontend                       |
| `npm start`         | Roda o build de produção                          |
| `npm run typecheck` | Checagem de tipos em todos os pacotes             |
| `npm run livekit:local` | Sobe o LiveKit em modo dev sem Docker (baixa o binário em `.cache/`) |
| `npm run livekit`   | Sobe o LiveKit via Docker Compose                 |
| `npm run test:e2e`  | Testes de ponta a ponta (sobe LiveKit e app sozinho) |

## Testes e CI

`npm run test:e2e` roda a suíte Playwright em `e2e/`: transmitir e assistir, trocar de tela sem interromper, qualidade ao vivo, métricas,
várias transmissões e zoom, chat com histórico e imagens, menu Amigos, salas fixas e o modo
celular. Na primeira vez, instale o navegador com `npx playwright install chromium`.

O GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda typecheck, build e
os testes em todo push. Na `main`, pode também publicar na VPS automaticamente: veja a seção
"Deploy automático" do [guia de deploy](deploy/README.md).

## Observações

- Não há autenticação: quem tem o link da sala entra e pode transmitir. O projeto é pensado
  para um grupo pequeno de amigos. Salas com nome simples (`/s/amigos`) são fáceis de
  adivinhar; se isso importar, use um nome menos óbvio ou o código aleatório.
- Os participantes só podem publicar compartilhamento de tela (nada de câmera ou microfone).
- O histórico do chat e as imagens ficam no servidor por 90 dias (`RETENTION_DAYS`). Imagens
  aceitas: PNG, JPEG, GIF e WebP, até 10 MB (`MAX_UPLOAD_MB`).
