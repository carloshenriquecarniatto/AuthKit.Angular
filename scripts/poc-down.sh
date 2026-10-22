#!/usr/bin/env bash
# Stops the demo server and destroys the isolated stack.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
net_root="${AUTHKIT_NET_ROOT:-$root/../AuthKit.Net}"

if [ -f "$root/.poc.pid" ]; then
  kill "$(cat "$root/.poc.pid")" 2>/dev/null || true
  rm -f "$root/.poc.pid"
fi

rm -f "$root/.poc.log"

bash "$net_root/scripts/pentest-down.sh"
