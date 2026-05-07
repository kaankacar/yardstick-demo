#!/usr/bin/env bash
# Create demo identities, issue the two demo assets (YARD + DEMOUSD) as
# classic Stellar assets, then wrap each as a Stellar Asset Contract so our
# Soroban contract can call `transfer` / `mint` / `trust` on them.
#
# Idempotent: re-running just refreshes the addresses in env.testnet.

source "$(dirname "$0")/_lib.sh"

echo "▶ Network: $NETWORK"

ADMIN_PK=$(ensure_identity "$ADMIN_ID")
USER_PK=$(ensure_identity "$USER_ID")
echo "  admin:     $ADMIN_PK"
echo "  demo user: $USER_PK"
write_env ADMIN_PK "$ADMIN_PK"
write_env USER_PK "$USER_PK"

# Native XLM SAC — already deployed on every network.
NATIVE_SAC=$(stellar contract id asset --asset native --network "$NETWORK")
echo "▶ native XLM SAC: $NATIVE_SAC"
write_env NATIVE_SAC "$NATIVE_SAC"

# Wrap YARD:<admin> and DEMOUSD:<admin> as SACs.
# `stellar contract id asset` computes the deterministic SAC ID for any asset;
# `stellar contract asset deploy` actually wraps it. We compute the ID first,
# then attempt to deploy and tolerate "ExistingValue" (asset already wrapped).
for asset_code in YARD DEMOUSD; do
  asset_id="$asset_code:$ADMIN_PK"
  sac=$(stellar contract id asset \
    --asset "$asset_id" \
    --network "$NETWORK")
  if stellar contract asset deploy \
        --asset "$asset_id" \
        --source-account "$ADMIN_ID" \
        --network "$NETWORK" 2>/tmp/sac-deploy.log >/dev/null; then
    echo "▶ wrapped $asset_id as $sac"
  elif grep -q "ExistingValue\|already exists" /tmp/sac-deploy.log; then
    echo "▶ $asset_id already wrapped at $sac"
  else
    cat /tmp/sac-deploy.log >&2
    exit 1
  fi
  write_env "${asset_code}_SAC" "$sac"
done

echo "✓ assets ready. env written to $ENV_FILE"
