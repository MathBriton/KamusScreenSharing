#!/usr/bin/env sh
# Gera deploy/.env e deploy/livekit.yaml com chaves aleatórias.
# Uso: ./setup.sh share.meudominio.com voce@email.com
set -eu
cd "$(dirname "$0")"

DOMAIN="${1:-}"
ACME_EMAIL="${2:-}"
if [ -z "$DOMAIN" ] || [ -z "$ACME_EMAIL" ]; then
  echo "Uso: $0 <dominio> <email-para-o-lets-encrypt>" >&2
  exit 1
fi

if [ -f .env ] && [ "${FORCE:-}" != "1" ]; then
  echo ".env já existe. Para regerar as chaves (desconecta todo mundo), rode com FORCE=1." >&2
  exit 1
fi

API_KEY="API$(openssl rand -hex 8)"
API_SECRET="$(openssl rand -base64 36 | tr -d '/+=\n')"

cat > .env <<ENV
DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL
LIVEKIT_API_KEY=$API_KEY
LIVEKIT_API_SECRET=$API_SECRET
ENV
chmod 600 .env

sed -e "s|__DOMAIN__|$DOMAIN|g" \
    -e "s|__API_KEY__|$API_KEY|g" \
    -e "s|__API_SECRET__|$API_SECRET|g" \
    livekit.yaml.template > livekit.yaml
chmod 600 livekit.yaml

echo "Pronto: .env e livekit.yaml gerados para $DOMAIN."
echo "Agora rode: docker compose up -d --build"
