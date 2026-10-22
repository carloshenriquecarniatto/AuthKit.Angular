#!/usr/bin/env bash
# Brings up the isolated stack and serves the AuthKit demo app on http://127.0.0.1:8088.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace="$root"
# The isolated Supabase stack lives in the .NET repository; both are expected side by side.
net_root="${AUTHKIT_NET_ROOT:-$root/../AuthKit.Net}"
env_file="$net_root/.pentest.env"
port="${POC_PORT:-8088}"

if [ -f "$root/.poc.pid" ] && kill -0 "$(cat "$root/.poc.pid")" 2>/dev/null; then
  echo "poc-up: already running at http://127.0.0.1:${port}"
  exit 0
fi

bash "$net_root/scripts/pentest-up.sh"

# shellcheck disable=SC1090
set -a
. "$env_file"
set +a

echo "poc-up: building the Angular library and demo (this takes a minute the first time)"
(cd "$workspace" && npm run build >/dev/null)

echo "poc-up: starting the demo server"
AUTH_URL="http://127.0.0.1:${AUTH_PORT}" \
REST_URL="http://127.0.0.1:${REST_PORT}" \
ANON_KEY="$ANON_KEY" \
DEMO_DIR="$workspace/dist/demo/browser" \
POC_PORT="$port" \
nohup node "$root/scripts/poc-server.mjs" >"$root/.poc.log" 2>&1 &

echo $! >"$root/.poc.pid"

for attempt in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${port}/config.js" >/dev/null 2>&1; then
    echo
    echo "POC ready: http://127.0.0.1:${port}"
    echo "Sign up with any e-mail; confirmation is disabled in this stack. Password: 8+ characters."
    echo "Stop with: bash scripts/poc-down.sh"
    exit 0
  fi
  sleep 1
done

echo "poc-up: the demo server did not start; log follows."
tail -40 "$root/.poc.log" || true
exit 1
