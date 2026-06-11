#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8787}"
CLOUDFLARED_BIN="$ROOT/tools/.bin/cloudflared"
WRANGLER_PID=""
TUNNEL_PID=""
TUNNEL_LOG=""

cleanup() {
  trap - EXIT INT TERM
  echo ""
  echo "Stopping local Telegram dev..."
  [[ -n "${TUNNEL_PID}" ]] && kill "${TUNNEL_PID}" 2>/dev/null || true
  [[ -n "${WRANGLER_PID}" ]] && kill "${WRANGLER_PID}" 2>/dev/null || true
  wait "${WRANGLER_PID}" 2>/dev/null || true
  wait "${TUNNEL_PID}" 2>/dev/null || true
  if [[ -f "${ROOT}/.dev.vars" ]] || [[ -f "${ROOT}/.env" ]]; then
    node "${ROOT}/tools/telegram-webhook.mjs" restore 2>/dev/null || true
  fi
  [[ -n "${TUNNEL_LOG}" && -f "${TUNNEL_LOG}" ]] && rm -f "${TUNNEL_LOG}"
}

trap cleanup EXIT INT TERM

ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    CLOUDFLARED_BIN="$(command -v cloudflared)"
    return
  fi

  if [[ -x "${CLOUDFLARED_BIN}" ]]; then
    return
  fi

  local arch url
  arch="$(uname -m)"
  case "${arch}" in
    x86_64) url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" ;;
    aarch64|arm64) url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64" ;;
    *)
      echo "Unsupported architecture: ${arch}. Install cloudflared manually."
      exit 1
      ;;
  esac

  mkdir -p "$(dirname "${CLOUDFLARED_BIN}")"
  echo "Downloading cloudflared..."
  curl -fsSL "${url}" -o "${CLOUDFLARED_BIN}"
  chmod +x "${CLOUDFLARED_BIN}"
}

require_dev_vars() {
  if [[ ! -f "${ROOT}/.dev.vars" && ! -f "${ROOT}/.env" ]]; then
    echo "Missing .dev.vars. Copy .env.example first."
    exit 1
  fi
}

wait_for_wrangler() {
  local i
  for i in $(seq 1 90); do
    if curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
      return 0
    fi
    if ! kill -0 "${WRANGLER_PID}" 2>/dev/null; then
      echo "wrangler exited before becoming ready."
      exit 1
    fi
    sleep 0.5
  done
  echo "Timed out waiting for wrangler on port ${PORT}."
  exit 1
}

read_tunnel_url() {
  local i url
  for i in $(seq 1 90); do
    url="$(
      grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "${TUNNEL_LOG}" 2>/dev/null | head -n 1 || true
    )"
    if [[ -n "${url}" ]]; then
      echo "${url}"
      return 0
    fi
    if ! kill -0 "${TUNNEL_PID}" 2>/dev/null; then
      echo "cloudflared exited before tunnel URL was ready." >&2
      cat "${TUNNEL_LOG}" >&2 || true
      exit 1
    fi
    sleep 0.5
  done
  echo "Timed out waiting for tunnel URL." >&2
  exit 1
}

cd "${ROOT}"
require_dev_vars
ensure_cloudflared

echo "Starting wrangler on http://127.0.0.1:${PORT} ..."
pnpm exec wrangler dev --local --port "${PORT}" &
WRANGLER_PID=$!

wait_for_wrangler

TUNNEL_LOG="$(mktemp)"
echo "Starting cloudflared tunnel ..."
"${CLOUDFLARED_BIN}" tunnel --url "http://127.0.0.1:${PORT}" >"${TUNNEL_LOG}" 2>&1 &
TUNNEL_PID=$!

TUNNEL_URL="$(read_tunnel_url)"
echo "Tunnel: ${TUNNEL_URL}"

node "${ROOT}/tools/telegram-webhook.mjs" local "${TUNNEL_URL}"

echo ""
echo "Local Telegram dev is ready."
echo "  Worker:  http://127.0.0.1:${PORT}"
echo "  Tunnel:  ${TUNNEL_URL}/bot"
echo "  Webhook: pointed at tunnel (production paused)"
echo ""
echo "Message @nekonymous_bot in Telegram to test."
echo "Press Ctrl+C to stop and restore production webhook."
echo ""

wait "${WRANGLER_PID}"
