# MEMORY.md

Memória de trabalho compartilhada entre **Claude Code** e **Codex**. Serve para quem pegar o projeto
(humano ou agente) continuar de onde a última sessão parou, sem perder contexto.

**Como manter:** ao fim de cada sessão, atualize "Estado atual" e "Próximos passos" e acrescente uma
entrada no topo do "Histórico" (data, ferramenta, o que mudou). Seja breve: fatos e decisões, não
narrativa. A especificação completa do projeto está no `CLAUDE.md`.

## Estado atual (2026-10-01)

- Branch principal: `main`. **Pendente**: marcá-la como padrão no GitHub (Settings → Branches); depois
  disso a branch antiga `claude/iniciar-projeto-n6nhpb` (mesmo conteúdo) pode ser apagada.
- Tudo verde: `npm run typecheck`, `npm run build` e **22 testes E2E** (`npm run test:e2e`).
- **Perfis nome + PIN**, menus **Salas / Amigos / sininho / Perfil** na barra superior e
  **mensagens privadas** entre amigos (SSE). Ver `CLAUDE.md` (tabelas de funcionalidades e API).
- Chat completo: menções, responder, fixar, busca, "digitando…" e rabiscar no print.
- `scripts/install-docker.sh` instala Docker + Compose em Linux (testado em Ubuntu 24.04).
- **UI repaginada** (dark industrial, verde-limão) seguindo `web/src/UI/README.md`; protótipo em
  `web/src/UI/referencias/prototipo.webp`.
- **Ainda não está em produção**: a VPS não foi contratada. Sugestões já discutidas: Oracle Cloud Free
  Tier (São Paulo/Vinhedo, ARM) ou Vultr/Linode São Paulo (2 GB). Guia em `deploy/README.md`.
- Deploy automático pronto, mas **desligado** até configurar a variável `DEPLOY_ENABLED=true` e os
  secrets no GitHub (ver `deploy/README.md`).

## Próximos passos / ideias em aberto

Sugestões já apresentadas e ainda não pedidas (o dono do projeto escolhe):

- Print da transmissão direto no chat (um clique/tecla `S`); prévia dos links (título/site/imagem,
  buscados no servidor com proteção contra SSRF); modo teatro (`T`, esconde sidebar e barras).
- Quem assiste o quê ("3 assistindo" no card); "trazer todos para minha tela" / seguir alguém.
- Título da transmissão ("Ranked · Valorant"); qualidade de recepção escolhida por quem assiste.
- Tecla `?` com os atalhos; lembrar Grade/Foco e sidebar por pessoa.
- Página de diagnóstico de conexão (UDP/TURN); backup automático; alerta de servidor fora do ar.
- Aviso no Discord via webhook quando alguém começa a transmitir.
- Título da aba com "🔴 ao vivo" e contador de não lidas; notificação do navegador.
- "Ping" na tela (marcar um ponto da transmissão para todos).
- Capturar quadro (PNG) e clipe dos últimos 30 s.
- Reações com emoji; estatísticas de conexão; PWA instalável.
- Grande: rodar como Discord Activity.

Pendências técnicas pequenas:

- Tornar `main` a branch padrão no GitHub (Settings → Branches) e apagar a branch antiga.
- A tabela `people` (antigos "vistos recentemente") não é mais escrita; só a limpeza a usa. Pode sair
  numa migração futura.
- Esqueci o PIN: não há recuperação pela interface. Hoje, apagar o usuário direto no SQLite
  (`DELETE FROM users WHERE name_key = ...`) e a pessoa cria de novo.
- O chat não pagina: o histórico traz as últimas 500 mensagens, e as abas Imagens/Links derivam delas.

## Decisões (e o porquê)

- **LiveKit como SFU** (não mediasoup): binário único, TURN embutido, SDKs prontos.
- **Perfil leve: nome + PIN** (escolha do dono, para as mensagens privadas): sem e-mail/senha. Nome
  único sem acentos/maiúsculas (`name_key`), PIN com scrypt, sessão = token aleatório (no banco só o
  sha256). 5 PINs errados bloqueiam o nome por 5 min (em memória): alguém pode travar o nome de outro
  por 5 min, aceito para um grupo de amigos. Perfis não expiram com a retenção.
- O **token do LiveKit** continua autenticando as rotas do chat; `/api/token` exige sessão e põe o
  `userId` nos atributos (identidade `userId:aleatório`, permite a mesma pessoa em duas abas).
- **Tempo real da conta por SSE** (`/api/me/events?token=`; `EventSource` não manda cabeçalho). O
  Caddyfile não comprime essa rota (senão o SSE fica preso no buffer).
- **Sininho**: DM, menção (em qualquer sala, pelo nome do perfil) e "ao vivo" (o cliente chama
  `POST /rooms/:sala/live` ao transmitir; 10 min de intervalo por pessoa+sala). Notificações e DMs
  seguem a retenção de 90 dias.
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
- **Chat pela API + LiveKit `sendData`** (tópico `chat`, eventos `message` e `pin`), não por text
  streams P2P: permite histórico e validação no servidor. Avisos de entrada/saída são só locais.
- **Menções são resolvidas no cliente** (nomes da sala + autores; regex com nomes mais longos
  primeiro). Sem contas, "@Nome" depende do nome digitado na entrada.
- **"Digitando…"** vai direto pelo LiveKit (`publishData`, tópico `typing`, não confiável/lossy),
  sem passar pelo servidor; expira em 4 s.
- **Mensagens fixadas não expiram** (ficam fora da retenção de 90 dias).
- **Rabiscar no print** gera um PNG novo no navegador (GIFs não são editáveis, perderiam a animação).
- **SQLite nativo (`node:sqlite`)**: sem dependência nativa para compilar. Emite ExperimentalWarning,
  silenciado com `--disable-warning=ExperimentalWarning`.
- **Retenção de 90 dias** (mensagens, imagens, "vistos"), configurável por `RETENTION_DAYS`.
- **"Amigos" = todos os perfis do servidor**; online = está em alguma sala (LiveKit), não na home.
- **Tudo sob um domínio** na produção; TURN/TLS reaproveita o certificado do Caddy (reiniciar o LiveKit
  mensalmente para pegar o certificado renovado; ver `deploy/README.md`).

## Armadilhas conhecidas

- `[vite] http proxy error: /api/...` = a API (:3001) não respondeu (caiu, não subiu, ou `localhost` virou
  `::1`). O proxy usa `127.0.0.1` e `npm run dev` (`scripts/dev.mjs`) prefixa os logs `[api]`/`[web]`,
  checa Node ≥ 22.5 e derruba os dois se um cair. `&`/`wait` no script quebravam no Windows (cmd).

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
- O Radix ScrollArea envolve o conteúdo em `display: table`, que estoura a largura com textos longos;
  `index.css` força `display: block` no filho do viewport.
- Grids CSS crescem com o conteúdo: use `grid-cols-1`/`min-w-0` em formulários da sidebar.
- `getByLabel('Mensagem')` também casa com as listas "Mensagens": nos testes use o `textbox` com
  `exact: true` (`chatInput` em `e2e/helpers.ts`).
- Ao inserir texto programaticamente num campo controlado, reposicione o cursor em
  `useLayoutEffect` (com `requestAnimationFrame`, digitação rápida sai fora de ordem).
- Migrações do SQLite: `addColumn()` em `server/src/db.ts` (idempotente).
- O painel de DM (Sheet do Radix) é modal: o resto da página sai da árvore de acessibilidade enquanto
  ele está aberto; nos testes, feche com `Escape` antes de procurar botões da barra.
- Nos testes os nomes se repetem entre arquivos: `login()` cria o perfil ou entra com o PIN padrão
  (`TEST_PIN`) e tenta de novo se dois testes criarem o mesmo nome ao mesmo tempo.

## Histórico

- **2026-10-01 · Claude Code**: correção do `http proxy error` no dev (proxy em `127.0.0.1`,
  `scripts/dev.mjs` multiplataforma, `engines` Node ≥ 22.5, login avisa "A API está rodando?"); 22 testes.

- **2026-10-01 · Claude Code**: perfis nome + PIN (login na home e no link da sala), menus Salas,
  Amigos (online/offline + mensagem), sininho (DM, menção, ao vivo) e Perfil (trocar nome/PIN, sair);
  mensagens privadas com SSE; API `/api/auth/*`, `/api/me/*`, `/api/rooms/active`, `/live`; barra da
  sala mais compacta; 21 testes E2E (`accounts.spec.ts` novo; `login()` em `e2e/helpers.ts`).

- **2026-09-30 · Claude Code**: chat com @menções (autocompletar, destaque, aviso), responder
  citando, fixar mensagens, busca no histórico, "digitando…" e rabiscar no print; API de pin/pins/
  search com migração do SQLite; `scripts/install-docker.sh` e guia do Docker; 16 testes E2E.
- **2026-09-30 · Claude Code**: pasta `UI/` movida para `web/src/UI/` (referências atualizadas).
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
