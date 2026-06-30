#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────
#  Rinran CRM — Setup & Installer
# ─────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC}  $*"; }
info() { echo -e "${CYAN}→${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*" >&2; }
sep()  { echo -e "${BLUE}────────────────────────────────────────────${NC}"; }

gen_secret() { openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64; }

clear
echo -e "${BOLD}${BLUE}"
echo "  ██████╗ ██╗███╗   ██╗██████╗  █████╗ ███╗   ██╗"
echo "  ██╔══██╗██║████╗  ██║██╔══██╗██╔══██╗████╗  ██║"
echo "  ██████╔╝██║██╔██╗ ██║██████╔╝███████║██╔██╗ ██║"
echo "  ██╔══██╗██║██║╚██╗██║██╔══██╗██╔══██║██║╚██╗██║"
echo "  ██║  ██║██║██║ ╚████║██║  ██║██║  ██║██║ ╚████║"
echo "  ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝"
echo -e "${NC}"
echo -e "${BOLD}  CRM de WhatsApp — Instalador${NC}"
sep
echo ""

# ── Prerequisite checks ────────────────────────────────────────
info "Verificando prerequisites…"

if ! command -v docker &>/dev/null; then
  err "Docker no está instalado."
  echo "   Instala Docker: https://docs.docker.com/engine/install/"
  exit 1
fi
ok "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1) detectado"

if ! docker compose version &>/dev/null 2>&1; then
  err "Docker Compose v2 no está disponible."
  echo "   Instala Docker Compose: https://docs.docker.com/compose/install/"
  exit 1
fi
ok "Docker Compose $(docker compose version --short 2>/dev/null || echo 'v2') detectado"

echo ""
sep
echo -e "${BOLD}  Configuración${NC}"
sep
echo ""

# ── Existing .env ──────────────────────────────────────────────
if [ -f .env ]; then
  warn ".env ya existe."
  read -rp "  ¿Sobreescribir con nueva configuración? [s/N]: " OVERWRITE
  if [[ ! "$OVERWRITE" =~ ^[sS]$ ]]; then
    info "Usando .env existente. Saltando configuración."
    SKIP_CONFIG=true
  fi
fi

if [ "${SKIP_CONFIG}" != "true" ]; then

  # Port
  read -rp "  Puerto del CRM [3000]: " PORT
  PORT="${PORT:-3000}"

  # Admin email
  read -rp "  Email del administrador [admin@miempresa.com]: " ADMIN_EMAIL
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@miempresa.com}"

  # Admin password
  while true; do
    read -rsp "  Contraseña del administrador: " ADMIN_PASSWORD; echo ""
    read -rsp "  Confirmar contraseña: " ADMIN_PASSWORD2; echo ""
    if [ -z "$ADMIN_PASSWORD" ]; then
      warn "La contraseña no puede estar vacía."
    elif [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD2" ]; then
      warn "Las contraseñas no coinciden, intenta de nuevo."
    elif [ "${#ADMIN_PASSWORD}" -lt 6 ]; then
      warn "Mínimo 6 caracteres."
    else
      break
    fi
  done

  # WAHA dashboard password
  read -rsp "  Contraseña del dashboard WAHA (vacío = generar automáticamente): " WAHA_DASH_PASS; echo ""
  if [ -z "$WAHA_DASH_PASS" ]; then
    WAHA_DASH_PASS="$(gen_secret | head -c 16)"
    info "Contraseña WAHA generada automáticamente."
  fi

  # Generate secrets
  JWT_SECRET="$(gen_secret)"
  WAHA_API_KEY="$(gen_secret)"

  # Write .env
  cat > .env <<EOF
# ──────────────────────────────────────────────
# Rinran CRM — Configuración
# ──────────────────────────────────────────────

# Puerto de acceso al CRM desde el navegador
FRONTEND_PORT=${PORT}

# ── Autenticación CRM ──────────────────────────
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# ── WAHA (WhatsApp HTTP API) ───────────────────
OPENWA_URL=http://waha:3000
OPENWA_API_KEY=${WAHA_API_KEY}
WAHA_API_KEY=${WAHA_API_KEY}
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=${WAHA_DASH_PASS}

# ── CORS ──────────────────────────────────────
CORS_ORIGIN=*
EOF

  ok ".env creado"
fi

echo ""
sep
echo -e "${BOLD}  Construyendo e iniciando contenedores…${NC}"
sep
echo ""

# ── Build & start ──────────────────────────────────────────────
docker compose pull waha 2>/dev/null || true
docker compose build --no-cache
echo ""
docker compose up -d

echo ""
info "Esperando que los servicios estén listos…"

# ── Health check ───────────────────────────────────────────────
TIMEOUT=60
ELAPSED=0
until docker compose exec -T backend node -e "require('http').get('http://localhost:4000/health',r=>{process.exit(r.statusCode===200?0:1)})" &>/dev/null; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    err "El backend no respondió en ${TIMEOUT}s. Revisa: docker compose logs backend"
    exit 1
  fi
  sleep 2; ELAPSED=$((ELAPSED+2)); printf "."
done
echo ""
ok "Backend listo"

until docker compose exec -T frontend wget -qO- http://localhost/index.html &>/dev/null; do
  if [ $ELAPSED -ge $((TIMEOUT+20)) ]; then
    err "El frontend no respondió. Revisa: docker compose logs frontend"
    exit 1
  fi
  sleep 2; ELAPSED=$((ELAPSED+2)); printf "."
done
ok "Frontend listo"

# ── Read final config ──────────────────────────────────────────
source .env
PORT="${FRONTEND_PORT:-3000}"
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"

echo ""
sep
echo -e "${BOLD}${GREEN}  ✓ Rinran CRM instalado correctamente${NC}"
sep
echo ""
echo -e "  ${BOLD}Acceso:${NC}"
echo -e "    CRM          →  ${CYAN}http://${SERVER_IP}:${PORT}${NC}"
echo -e "    WAHA dashboard → ${CYAN}http://${SERVER_IP}:3001/dashboard${NC}"
echo ""
echo -e "  ${BOLD}Credenciales CRM:${NC}"
echo -e "    Email      →  ${YELLOW}${ADMIN_EMAIL}${NC}"
echo -e "    Contraseña →  ${YELLOW}${ADMIN_PASSWORD}${NC}"
echo ""
echo -e "  ${BOLD}Credenciales WAHA:${NC}"
echo -e "    Usuario    →  ${YELLOW}admin${NC}"
echo -e "    Contraseña →  ${YELLOW}${WAHA_DASHBOARD_PASSWORD}${NC}"
echo ""
echo -e "  ${BOLD}Próximos pasos:${NC}"
echo -e "    1. Abre el CRM e inicia sesión"
echo -e "    2. Ve a ${CYAN}WhatsApp / Sesiones${NC} y crea una sesión"
echo -e "    3. Escanea el QR con WhatsApp para conectar"
echo ""
sep
echo -e "  Comandos útiles:"
echo -e "    ${CYAN}docker compose logs -f${NC}        → ver logs en vivo"
echo -e "    ${CYAN}docker compose down${NC}           → detener"
echo -e "    ${CYAN}docker compose up -d${NC}          → reiniciar"
echo -e "    ${CYAN}./setup.sh${NC}                    → reconfigurar"
sep
echo ""
