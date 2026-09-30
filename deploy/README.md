# Deploy em uma VPS

Tudo roda numa única VPS com Docker Compose, sem Kubernetes:

| Serviço   | O que faz                                                                 |
| --------- | ------------------------------------------------------------------------- |
| `caddy`   | HTTPS automático (Let's Encrypt) e proxy para o app e para o LiveKit      |
| `livekit` | SFU (distribui a tela para os espectadores) com **TURN embutido**         |
| `app`     | API de tokens + frontend (imagem gerada pelo `Dockerfile` da raiz)        |

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

## Problemas comuns

- **Espectador fica em "Aguardando…" com o apresentador ao vivo**: normalmente é
  UDP/TCP bloqueado. Confira as portas acima nos dois firewalls (VPS e provedor).
- **Certificado não é emitido**: o registro DNS precisa apontar para a VPS e as portas
  80/443 precisam estar abertas. Veja `docker compose logs caddy`.
- **`use_external_ip`**: o LiveKit descobre o IP público via STUN. Se a VPS tiver um
  IP público diferente do que o STUN retorna (raro), defina `rtc.node_ip` no
  `livekit.yaml`.
