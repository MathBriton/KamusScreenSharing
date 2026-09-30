# Deploy em uma VPS

Tudo roda numa única VPS com Docker Compose, sem Kubernetes:

| Serviço   | O que faz                                                                 |
| --------- | ------------------------------------------------------------------------- |
| `caddy`   | HTTPS automático (Let's Encrypt) e proxy para o app e para o LiveKit      |
| `livekit` | SFU (distribui a tela para os espectadores) com **TURN embutido**         |
| `app`     | API (tokens, chat, amigos) + frontend (imagem do `Dockerfile` da raiz)    |

O chat (banco SQLite e imagens coladas) fica no volume Docker `kamus_app_data`.

Tudo fica sob **um único domínio** (ex.: `share.seudominio.com`):

- `https://share.seudominio.com` → app
- `wss://share.seudominio.com/rtc` → LiveKit (sinalização)
- `turns:share.seudominio.com:5349` → TURN/TLS, usando o mesmo certificado do Caddy

## Requisitos

- VPS Linux com IP público. **2 vCPU / 2 GB de RAM** sobram para poucos amigos.
  O que pesa é a banda: cada espectador recebe ~1–3 Mbps.
- Docker com o plugin Compose (`docker compose version`)
- Um domínio (ou subdomínio) com registro **A** apontando para o IP da VPS

## Portas no firewall

| Porta       | Protocolo | Uso                                  |
| ----------- | --------- | ------------------------------------ |
| 80, 443     | TCP       | HTTPS (Caddy) e emissão do certificado |
| 7881        | TCP       | WebRTC via TCP (fallback)            |
| 7882        | UDP       | WebRTC (mídia)                       |
| 3478        | UDP       | TURN/UDP                             |
| 5349        | TCP       | TURN/TLS                             |

Com UFW:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80,443,7881,5349/tcp
sudo ufw allow 7882,3478/udp
sudo ufw enable
```

As portas 7880 (LiveKit) e 3001 (app) **não** devem ficar abertas, porque o Caddy faz o
proxy para elas localmente. Se o provedor da VPS tiver um firewall próprio (painel da
Hetzner, Security Group da AWS etc.), libere as mesmas portas lá.

## Passo a passo

```bash
git clone <este-repositorio> kamus && cd kamus/deploy

# Gera .env e livekit.yaml com chaves aleatórias
./setup.sh share.seudominio.com voce@email.com

docker compose up -d --build
docker compose logs -f
```

Na primeira subida, o Caddy precisa de alguns segundos para emitir o certificado. Até
lá, o LiveKit reinicia algumas vezes porque o TURN/TLS ainda não achou o arquivo do
certificado. Isso é esperado e se resolve sozinho.

Depois acesse `https://share.seudominio.com`.

## Renovação do certificado do TURN

O Caddy renova o certificado sozinho, mas o LiveKit só lê o arquivo ao iniciar. Um
restart mensal resolve (o certificado vale 90 dias e é renovado 30 dias antes):

```bash
# crontab -e
0 5 1 * * cd /caminho/para/kamus/deploy && docker compose restart livekit
```

O restart derruba as salas ativas por alguns segundos, por isso o horário de madrugada.

## Atualizar

```bash
git pull
docker compose up -d --build
```

## Deploy automático (GitHub Actions)

O workflow `.github/workflows/ci.yml` roda os testes em todo push. Se estiver habilitado, a cada
push na `main` com testes verdes ele entra na VPS por SSH e roda `git reset --hard origin/main` e
`docker compose up -d --build`. Os arquivos `deploy/.env` e `deploy/livekit.yaml` não são
versionados, então não são afetados.

1. Na VPS, clone o repositório (ex.: em `~/kamus`) e faça o primeiro deploy manual, como acima. O
   usuário do deploy precisa estar no grupo `docker` (`sudo usermod -aG docker $USER`). Se o
   repositório for privado, cadastre uma *deploy key* de leitura para o `git fetch` funcionar.
2. Gere uma chave só para o GitHub Actions e autorize-a na VPS:
   ```bash
   ssh-keygen -t ed25519 -f kamus_deploy -N ""
   ssh-copy-id -i kamus_deploy.pub usuario@sua-vps
   ```
3. No GitHub, em **Settings → Secrets and variables → Actions**:

   | Tipo | Nome | Valor |
   | --- | --- | --- |
   | Secret | `DEPLOY_HOST` | IP ou domínio da VPS |
   | Secret | `DEPLOY_USER` | usuário SSH |
   | Secret | `DEPLOY_SSH_KEY` | conteúdo de `kamus_deploy` (chave **privada**) |
   | Secret (opcional) | `DEPLOY_PATH` | pasta do repositório na VPS (padrão `~/kamus`) |
   | Secret (opcional) | `DEPLOY_PORT` | porta SSH (padrão `22`) |
   | Secret (opcional) | `DEPLOY_KNOWN_HOSTS` | saída de `ssh-keyscan sua-vps` (recomendado; sem ele o host é aceito na primeira conexão) |
   | Variable | `DEPLOY_ENABLED` | `true` |

Sem `DEPLOY_ENABLED=true`, o job de deploy é simplesmente pulado.

## Backup do chat

```bash
docker run --rm -v kamus_app_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/kamus-chat-$(date +%F).tgz -C /data .
```

Mensagens e imagens com mais de 90 dias são apagadas automaticamente. Para mudar o prazo,
defina `RETENTION_DAYS` no `deploy/.env`.

## Problemas comuns

- **Espectador fica em "Aguardando…" com o apresentador ao vivo**: normalmente é
  UDP/TCP bloqueado. Confira as portas acima nos dois firewalls (VPS e provedor).
- **Certificado não é emitido**: o registro DNS precisa apontar para a VPS e as portas
  80/443 precisam estar abertas. Veja `docker compose logs caddy`.
- **`use_external_ip`**: o LiveKit descobre o IP público via STUN. Se a VPS tiver um
  IP público diferente do que o STUN retorna (raro), defina `rtc.node_ip` no
  `livekit.yaml`.
