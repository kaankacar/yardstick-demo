#!/usr/bin/env bash
# Fund the contract's treasury so it can hand out XLM bootstraps + starter
# token balances during onboarding, and so the AMM has reserves to swap from.
#
#   ~50 XLM    — covers ~50 onboardings at 1 XLM each + Soroban fees
#   100k YARD  — AMM reserve + onboarding starters (100 YARD each)
#   100k USD   — AMM reserve + onboarding starters (100 DEMOUSD each)

source "$(dirname "$0")/_lib.sh"
load_env
require_env CONTRACT_ID NATIVE_SAC YARD_SAC DEMOUSD_SAC ADMIN_PK

XLM_AMOUNT=5000000000     # 500 XLM, in stroops (50 onboardings × 1 XLM + headroom)
RESERVE_AMOUNT=1000000000000  # 100k tokens, 7-decimal classic-asset units

echo "▶ sending $((XLM_AMOUNT / 10000000)) XLM from admin → contract"
stellar contract invoke \
  --id "$NATIVE_SAC" \
  --source-account "$ADMIN_ID" \
  --network "$NETWORK" \
  -- transfer \
  --from "$ADMIN_PK" \
  --to "$CONTRACT_ID" \
  --amount "$XLM_AMOUNT"

for asset_code in YARD DEMOUSD; do
  sac_var="${asset_code}_SAC"
  sac="${!sac_var}"
  echo "▶ minting $((RESERVE_AMOUNT / 10000000)) $asset_code → contract"
  stellar contract invoke \
    --id "$sac" \
    --source-account "$ADMIN_ID" \
    --network "$NETWORK" \
    -- mint \
    --to "$CONTRACT_ID" \
    --amount "$RESERVE_AMOUNT"
done

echo "▶ reserves now held by contract:"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$ADMIN_ID" \
  --network "$NETWORK" \
  -- reserves

echo "✓ treasury funded"
