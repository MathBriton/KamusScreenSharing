# MEMORY.md

Memória de trabalho compartilhada entre **Claude Code** e **Codex**. Serve para quem pegar o projeto
(humano ou agente) continuar de onde a última sessão parou, sem perder contexto.

**Como manter:** ao fim de cada sessão, atualize "Estado atual" e "Próximos passos" e acrescente uma
entrada no topo do "Histórico" (data, ferramenta, o que mudou). Seja breve: fatos e decisões, não
narrativa. A especificação completa do projeto está no `CLAUDE.md`.

## Estado atual (2026-09-30)

- Branch principal: `main`. **Pendente**: marcá-la como padrão no GitHub (Settings → Branches); depois
  disso a branch antiga `claude/iniciar-projeto-n6nhpb` (mesmo conteúdo) pode ser apagada.
- Tudo verde: `npm run typecheck`, `npm run build` e **11 testes E2E** (`npm run test:e2e`).
- **UI repaginada** (dark industrial, verde-limão) seguindo `UI/README.md`; protótipo em
  `UI/referencias/prototipo.webp`.
- **Ainda não está em produção**: a VPS não foi contratada. Sugestões já discutidas: Oracle Cloud Free
  Tier (São Paulo/Vinhedo, ARM) ou Vultr/Linode São Paulo (2 GB). Guia em `deploy/README.md`.
- Deploy automático pronto, mas **desligado** até configurar a variável `DEPLOY_ENABLED=true` e os
  secrets no GitHub (ver `deploy/README.md`).

## Próximos passos / ideias em aberto

Sugestões já apresentadas e ainda não pedidas (o dono do projeto escolhe):

- Aviso no Discord via webhook quando alguém começa a transmitir.
- Título da aba com "🔴 ao vivo" e contador de não lidas; notificação do navegador.
- "Ping" na tela (marcar um ponto da transmissão para todos).
- Capturar quadro (PNG) e clipe dos últimos 30 s.
- Reações com emoji; estatísticas de conexão; PWA instalável.
- Grande: rodar como Discord Activity.

Pendências técnicas pequenas:

- Tornar `main` a branch padrão no GitHub (Settings → Branches) e apagar a branch antiga.
- O chat não pagina: o histórico traz as últimas 500 mensagens, e as abas Imagens/Links derivam delas.

## Decisões (e o porquê)

- **LiveKit como SFU** (não mediasoup): binário único, TURN embutido, SDKs prontos.
- **Sem autenticação**: projeto para poucos amigos. O token do LiveKit é usado para autenticar as rotas
  do chat (garante que a pessoa está na sala e não fala em nome de outra).
- **Qualquer um pode apresentar; várias transmissões ao mesmo tempo**. O papel é só um atributo
  (`role`) que o próprio participante altera (`canUpdateOwnMetadata`), sem reconectar.
- **Áudio da transmissão desligado por padrão**: o grupo usa o Discord para voz.
- **Mic e Áudio só visuais** (desabilitados, com dica): pedidos na spec de UI, mas a voz segue no
  Discord. Reservam o lugar para uma voz futura.
- **Transmitir × Compartilhar tela**: Transmitir inicia/para; Compartilhar tela troca a fonte com
  `LocalTrack.replaceTrack` (sem interromper quem assiste). Não há mais papel escolhido na entrada nem
  `?apresentar`: o atributo `role` acompanha a transmissão.
- **Métricas**: ping = `room.engine.client.rtt`; resolução/FPS/bitrate = `getSenderStats`/
  `getReceiverStats` da transmissão selecionada (grade pequena usa camada simulcast menor, então a
  resolução exibida cai; é o dado real recebido).
- **Chat pela API + LiveKit `sendData`** (tópico `chat`), não por text streams P2P: permite histórico
  e validação no servidor. Avisos de entrada/saída são só locais (não gravados).
- **SQLite nativo (`node:sqlite`)**: sem dependência nativa para compilar. Emite ExperimentalWarning,
  silenciado com `--disable-warning=ExperimentalWarning`.
- **Retenção de 90 dias** (mensagens, imagens, "vistos"), configurável por `RETENTION_DAYS`.
- **"Amigos" = quem usa o servidor**, identificado pelo nome (sem contas); online vem do LiveKit.
- **Tudo sob um domínio** na produção; TURN/TLS reaproveita o certificado do Caddy (reiniciar o LiveKit
  mensalmente para pegar o certificado renovado; ver `deploy/README.md`).

## Armadilhas conhecidas

- `livekit-server --dev` sem `--bind` tenta IPv6 (`::1`) e falha em ambientes sem IPv6. O script
  `scripts/livekit-dev.sh` já usa `--bind 127.0.0.1`.
- Console do navegador mostra 404 em `/rtc/v1`: é esperado (o cliente tenta o endpoint novo e cai para
  o antigo no LiveKit 1.9).
- `res.sendFile` do Express recusa caminhos com pastas ocultas: usar `{ dotfiles: 'allow' }`
  (o `DATA_DIR` dos testes é `e2e/.data`).
- `RoomEvent.TrackUnsubscribed` dispara **antes** de a publicação sair do participante; para atualizar
  listas de transmissões, ouvir também `TrackUnpublished`.
- `room.numParticipants` da API do LiveKit atualiza com atraso: não usar para filtrar salas.
- O registro do shadcn (`ui.shadcn.com`) pode estar bloqueado em sandboxes; ver `CLAUDE.md`.
- O Chromium do sandbox do Claude Code é de outra versão do Playwright: usar `PW_CHROMIUM_PATH`.
- Atalhos de teclado (F, G, P, 1–9, + - 0) são ignorados com o foco num campo de texto; nos testes,
  tirar o foco antes (`blur()` em `e2e/helpers.ts`).
- Seletor `text=Entrar na sala` também casa com o título da home convidada; use `getByRole('button')`.
- TypeScript 7 (nativo) está em uso: `baseUrl` não existe mais; `paths` são relativos ao tsconfig.

## Histórico

- **2026-09-30 · Claude Code**: repaginação da UI (pasta `UI/` com spec, tokens e protótipo; tema
  escuro fixo com Inter/JetBrains Mono; barra superior com LIVE, código e métricas; cards de
  transmissão; Grade/Foco; sidebar com conexão e `1080p · FPS`; barra inferior; trocar tela sem
  interromper; aviso de reconexão; testes atualizados).
- **2026-09-30 · Claude Code**: chat persistente (SQLite) com abas Imagens/Links, colar imagens e links
  clicáveis; várias transmissões simultâneas (Foco/Lado a lado) e zoom; topbar com menu Amigos; aviso
  e modo "só assistir" no celular; suíte Playwright (11 testes) e CI/CD no GitHub Actions;
  CLAUDE.md/MEMORY.md/AGENTS.md; branch `main` criada.
- **2026-09-30 · Claude Code**: qualidade escolhida ao vivo, tela cheia e PiP, salas fixas `/s/<sala>`,
  avisos de entrada/saída; migração da UI para shadcn/ui; deploy em VPS (Caddy + LiveKit + TURN).
- **2026-09-30 · Claude Code**: projeto iniciado (React + Vite + Express + LiveKit), chat e lista de
  participantes.
