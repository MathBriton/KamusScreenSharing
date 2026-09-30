# Kamus Screen Sharing

Compartilhamento de tela **1-para-muitos** direto no navegador, para uso entre amigos (a voz
fica no Discord). Quem apresenta cria uma sala e compartilha a tela; os espectadores entram pelo
link, sem instalar nada.

## Recursos

- **Topbar com menu Amigos**: quem está online agora (em qual sala, se está ao vivo, botão
  **Entrar**) e quem foi visto recentemente.
- **Salas fixas do grupo**: `/s/amigos` é sempre o mesmo link; a home lembra as salas recentes.
  Quem abre o link entra assistindo e pode clicar em **Apresentar** a qualquer momento.
- **Várias transmissões ao mesmo tempo**: cada espectador escolhe qual ver (modo **Foco**, com as
  outras em miniatura) ou vê todas **lado a lado**.
- **Qualidade escolhida por quem apresenta**: Texto/código (1080p 15 fps), Equilibrado
  (1080p 30 fps), Jogo/vídeo (720p 60 fps) e Máxima (1080p 60 fps), trocada na hora.
- **Áudio da transmissão opcional** e desligado por padrão (com o Discord aberto, as vozes
  sairiam em dobro).
- **Para quem assiste**: **zoom** (roda do mouse, pinça, arrastar, teclas `+` `-` `0`), tela cheia
  (tecla **F** ou duplo clique) e janela flutuante picture-in-picture (tecla **P**).
- **Chat com histórico** (quem chega depois vê a conversa): links clicáveis, **colar ou arrastar
  prints**, prévia de links de GIF/imagem e abas **Imagens** e **Links** com tudo o que foi
  compartilhado. O histórico é guardado por 90 dias.
- **Avisos** de entrada, saída e início/fim de transmissão.
- **Celular**: navegadores de celular não conseguem compartilhar a tela; o app explica isso e
  entra só para assistir.

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
  ou Docker (`npm run livekit`)

## Como rodar em desenvolvimento

```bash
npm install
cp .env.example .env

# 1. Suba o LiveKit em modo dev (chaves devkey/secret)
npm run livekit:local      # ou, com Docker: npm run livekit

# 2. Em outro terminal, suba a API e o frontend
npm run dev
```

Abra http://localhost:5173, clique em **Criar sala e compartilhar** (ou dê um nome à sala)
e depois em **Compartilhar tela**. Use **Copiar link** e abra o link em outra aba ou em outro navegador
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

`npm run test:e2e` roda a suíte Playwright em `e2e/`: apresentar e assistir, qualidade ao vivo,
várias transmissões e zoom, chat com histórico e imagens, menu Amigos, salas fixas e o modo
celular. Na primeira vez, instale o navegador com `npx playwright install chromium`.

O GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda typecheck, build e
os testes em todo push. Na `main`, pode também publicar na VPS automaticamente: veja a seção
"Deploy automático" do [guia de deploy](deploy/README.md).

## Observações

- Não há autenticação: quem tem o link da sala entra e pode apresentar. O projeto é pensado
  para um grupo pequeno de amigos. Salas com nome simples (`/s/amigos`) são fáceis de
  adivinhar; se isso importar, use um nome menos óbvio ou o código aleatório.
- Os participantes só podem publicar compartilhamento de tela (nada de câmera ou microfone).
- O histórico do chat e as imagens ficam no servidor por 90 dias (`RETENTION_DAYS`). Imagens
  aceitas: PNG, JPEG, GIF e WebP, até 10 MB (`MAX_UPLOAD_MB`).
