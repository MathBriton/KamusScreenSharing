#!/usr/bin/env sh
# Instala Docker Engine + Docker Compose (plugin "docker compose") pelo repositório oficial.
#
# Uso (na VPS ou num Linux seu):
#   curl -fsSL https://raw.githubusercontent.com/MathBriton/KamusScreenSharing/main/scripts/install-docker.sh | sh
#   # ou, com o repositório já clonado:
#   sh scripts/install-docker.sh
#   FORCE_INSTALL=1 sh scripts/install-docker.sh   # reinstala/atualiza
#
# Suporta Ubuntu, Debian, Oracle Linux, Rocky, AlmaLinux, CentOS, RHEL e Fedora.
# No Windows e no macOS, instale o Docker Desktop (veja deploy/README.md).
set -eu

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31merro:\033[0m %s\n' "$*" >&2; exit 1; }

if [ "$(uname -s)" != "Linux" ]; then
  fail "este script é para Linux. No Windows/macOS use o Docker Desktop: https://docs.docker.com/desktop/"
fi

# FORCE_INSTALL=1 reinstala/atualiza mesmo se já houver Docker.
if [ "${FORCE_INSTALL:-}" != "1" ] && command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  say "Docker e Docker Compose já estão instalados:"
  docker --version
  docker compose version
  exit 0
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || fail "rode como root ou instale o sudo."
  SUDO="sudo"
fi

[ -r /etc/os-release ] || fail "não consegui identificar a distribuição (/etc/os-release ausente)."
. /etc/os-release
DISTRO="${ID:-}"
LIKE="${ID_LIKE:-}"
PACKAGES="docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"

install_apt() {
  # Ubuntu e Debian (e derivados como Linux Mint/Pop!_OS, via ID_LIKE).
  case "$DISTRO" in
    ubuntu | debian) REPO_DISTRO="$DISTRO" ;;
    *) case "$LIKE" in *ubuntu*) REPO_DISTRO=ubuntu ;; *) REPO_DISTRO=debian ;; esac ;;
  esac
  CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
  [ -n "$CODENAME" ] || fail "não encontrei o codinome da versão (VERSION_CODENAME)."

  say "Instalando pelo repositório oficial ($REPO_DISTRO $CODENAME)"
  $SUDO apt-get update -y
  $SUDO apt-get install -y ca-certificates curl
  $SUDO install -m 0755 -d /etc/apt/keyrings
  $SUDO curl -fsSL "https://download.docker.com/linux/$REPO_DISTRO/gpg" -o /etc/apt/keyrings/docker.asc
  $SUDO chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$REPO_DISTRO $CODENAME stable" |
    $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
  $SUDO apt-get update -y
  # shellcheck disable=SC2086
  $SUDO apt-get install -y $PACKAGES
}

install_dnf() {
  case "$DISTRO" in
    fedora) REPO_URL="https://download.docker.com/linux/fedora/docker-ce.repo" ;;
    rhel) REPO_URL="https://download.docker.com/linux/rhel/docker-ce.repo" ;;
    # Oracle Linux, Rocky, Alma e CentOS usam o repositório do CentOS.
    *) REPO_URL="https://download.docker.com/linux/centos/docker-ce.repo" ;;
  esac
  say "Instalando pelo repositório oficial ($DISTRO)"
  $SUDO dnf -y install dnf-plugins-core
  # dnf 4 usa --add-repo; dnf 5 (Fedora 41+) usa "addrepo --from-repofile".
  $SUDO dnf config-manager --add-repo "$REPO_URL" 2>/dev/null ||
    $SUDO dnf config-manager addrepo --from-repofile="$REPO_URL"
  # shellcheck disable=SC2086
  $SUDO dnf -y install $PACKAGES
}

unsupported() { fail "distribuição não suportada: $DISTRO. Veja https://docs.docker.com/engine/install/"; }
case "$DISTRO" in
  ubuntu | debian) install_apt ;;
  fedora | rhel | centos | ol | rocky | almalinux) install_dnf ;;
  *)
    # Derivados: decide pela família (ID_LIKE).
    case " $LIKE " in
      *" ubuntu "* | *" debian "*) install_apt ;;
      *" rhel "* | *" fedora "* | *" centos "*) install_dnf ;;
      *) unsupported ;;
    esac
    ;;
esac

if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  say "Ativando o serviço do Docker"
  $SUDO systemctl enable --now docker
else
  say "Sem systemd: inicie o Docker manualmente (ex.: sudo dockerd &)."
fi

# Permite usar "docker" sem sudo (vale a partir do próximo login).
TARGET_USER="${SUDO_USER:-$(id -un)}"
if [ "$TARGET_USER" != "root" ]; then
  say "Adicionando $TARGET_USER ao grupo docker"
  $SUDO usermod -aG docker "$TARGET_USER"
fi

say "Pronto:"
docker --version
docker compose version
echo
echo "Saia e entre de novo no SSH para usar 'docker' sem sudo. Teste com: docker run --rm hello-world"
