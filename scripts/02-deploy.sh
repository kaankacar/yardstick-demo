#!/usr/bin/env bash
# Build the contract WASM (release profile), upload it to the network, deploy
# a fresh instance, and call `initialize` with the SAC addresses written to
# env.testnet by 01-issue-assets.sh.

source "$(dirname "$0")/_lib.sh"
load_env
require_env ADMIN_PK NATIVE_SAC YARD_SAC DEMOUSD_SAC

echo "▶ building contract WASM"
(cd "$REPO_ROOT" && stellar contract build) >/dev/null
echo "  $WASM ($(wc -c <"$WASM") bytes)"

echo "▶ deploying contract instance"
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$ADMIN_ID" \
  --network "$NETWORK")
echo "  contract: $CONTRACT_ID"
write_env CONTRACT_ID "$CONTRACT_ID"

echo "▶ initializing"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$ADMIN_ID" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$ADMIN_PK" \
  --native_sac "$NATIVE_SAC" \
  --yard_sac "$YARD_SAC" \
  --usd_sac "$DEMOUSD_SAC"

echo "✓ deployed and initialized. env written to $ENV_FILE"
