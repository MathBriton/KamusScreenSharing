#!/usr/bin/env sh
# Baixa (uma vez) e roda o livekit-server em modo dev, sem Docker.
# Usado pelos testes E2E e útil para desenvolver sem Docker.
set -eu
VERSION="${LIVEKIT_VERSION:-1.9.1}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/.cache/livekit-$VERSION"
BIN="$DIR/livekit-server"

if [ ! -x "$BIN" ]; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) ARCH=linux_amd64 ;;
    Linux-aarch64 | Linux-arm64) ARCH=linux_arm64 ;;
    Darwin-arm64) ARCH=darwin_arm64 ;;
    Darwin-x86_64) ARCH=darwin_amd64 ;;
    *) echo "Plataforma não suportada: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
  esac
  mkdir -p "$DIR"
  echo "Baixando livekit-server $VERSION ($ARCH)..."
  curl -fsSL "https://github.com/livekit/livekit/releases/download/v$VERSION/livekit_${VERSION}_$ARCH.tar.gz" \
    | tar -xz -C "$DIR" livekit-server
fi

exec "$BIN" --dev --bind 127.0.0.1 "$@"
