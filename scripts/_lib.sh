#!/usr/bin/env bash
# Shared config + helpers, sourced by the numbered scripts.
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[1]}")" &>/dev/null && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." &>/dev/null && pwd)"
ENV_FILE="$SCRIPT_DIR/env.$NETWORK"
WASM="$REPO_ROOT/target/wasm32v1-none/release/onboard_swap.wasm"

# Identities the demo expects:
#   admin       — issuer of YARD + DEMO_USD, contract admin, treasury funder
#   demo_user   — first user the dApp will onboard, used by the smoke-test
ADMIN_ID="${ADMIN_ID:-yardstick-admin}"
USER_ID="${USER_ID:-yardstick-user}"

ensure_identity() {
  local name="$1"
  if ! stellar keys ls 2>/dev/null | grep -q "^$name$"; then
    echo "→ creating + funding identity: $name" >&2
    stellar keys generate "$name" --network "$NETWORK" --fund >/dev/null 2>&1
  fi
  stellar keys public-key "$name"
}

write_env() {
  local key="$1" value="$2"
  touch "$ENV_FILE"
  if grep -q "^$key=" "$ENV_FILE" 2>/dev/null; then
    # macOS sed-compatible in-place replace
    sed -i '' "s|^$key=.*|$key=$value|" "$ENV_FILE"
  else
    echo "$key=$value" >> "$ENV_FILE"
  fi
}

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$ENV_FILE"; set +a
  fi
}

require_env() {
  for k in "$@"; do
    if [[ -z "${!k:-}" ]]; then
      echo "✗ $k is not set in $ENV_FILE — run the earlier scripts first." >&2
      exit 1
    fi
  done
}
