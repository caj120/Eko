#!/usr/bin/env bash
# Run Eko headless in a GitHub Codespace (or any Linux box with Nix).
#
#   Terminal 1:  nix develop -c ./dev/codespace.sh 1     (builds, starts network services, agent 1)
#   Terminal 2:  nix develop -c ./dev/codespace.sh 2     (agent 2, same network)
#
# Agent N serves its UI on port 1419+N. Open each forwarded port in a
# separate browser tab to act as two different people.
set -euo pipefail

N="${1:-1}"
ADMIN=$((9000 + N))
APP=$((8000 + N))
UI=$((1419 + N))
BOOT_PORT=4000
SIG_PORT=4001
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANDBOX="/tmp/eko-sandbox-$N"

cd "$ROOT"

if [ "$N" = "1" ]; then
  [ -f workdir/eko.happ ] || npm run build:happ
  echo "[eko] starting local bootstrap and signal services"
  hc run-local-services --bootstrap-port "$BOOT_PORT" --signal-port "$SIG_PORT" \
    > /tmp/eko-services.log 2>&1 &
  sleep 3
fi

rm -rf "$SANDBOX" && mkdir -p "$SANDBOX"
(
  cd "$SANDBOX"
  echo "[eko] generating sandbox for agent $N"
  hc sandbox generate "$ROOT/workdir/eko.happ" --app-id eko \
    network --bootstrap "http://127.0.0.1:$BOOT_PORT" webrtc "ws://127.0.0.1:$SIG_PORT"

  echo "[eko] starting conductor (admin $ADMIN)"
  echo pass | hc sandbox run --piped --force-admin-ports "$ADMIN" 0 \
    > "/tmp/eko-conductor-$N.log" 2>&1 &

  sleep 8
  hc sandbox call --running "$ADMIN" add-app-ws \
    --port "$APP" --allowed-origins "http://localhost:1420"
)

echo "[eko] UI for agent $N on port $UI"
cd ui
VITE_HC_PROXY=1 HC_ADMIN_PORT="$ADMIN" HC_APP_PORT="$APP" \
  npx vite --port "$UI" --host
