# Yardstick "So What" Demo

**Live page → https://kaankacar.github.io/yardstick-demo/**
*(testnet, contract `CAM3JG…RGDEF4B`, RPC `soroban-testnet.stellar.org`)*

A minimal, runnable Stellar Yardstick (Protocol 26) demo. Combines two
new builder capabilities in one atomic flow:

- **CAP-73** — `StellarAssetClient::trust()` lets a Soroban contract
  create classic Stellar trustlines directly. Combined with the native
  SAC's "transfer to non-existent account" path, the contract can bring
  a brand-new user fully online in **one transaction**.
- **CAP-82** — `U256::checked_mul` / `checked_add` return `Option<U256>`
  on overflow, so DeFi pricing math degrades gracefully instead of
  trapping the entire transaction.

The webpage shows the actual deployed Rust source side-by-side with a
display-only pre-Yardstick version, so viewers can read what changed.

## Live demo, three transactions

Hashes from a recent run on testnet (`CAM3JG...`):

| Step | What | Tx |
|---|---|---|
| Onboard | 1 XLM transfer + 2× SAC `trust()` + 2× starter balance, atomic | [`761b0892…`](https://stellar.expert/explorer/testnet/tx/761b0892086c464c65cf28a8cd4730c5be7457739651e445039dfed925b52ad7) |
| Swap | 5 YARD → 4.9997 DEMOUSD via `U256::checked_mul` | [`a5ec51be…`](https://stellar.expert/explorer/testnet/tx/a5ec51bee0e56f2c87843bddad1c44176dc73c54aa1f90bd49fbe02f1cbb241a) |
| Overflow | `quote(2^150, …)` returns `Error(Contract, #7) = SwapError::Overflow` instead of trapping | (sim-only) |

## Repo layout

```
contracts/onboard_swap/
  src/lib.rs              # POST-Yardstick — deployed
  src/contract_legacy.rs  # PRE-Yardstick — display only, never deployed
  src/test.rs             # 7 integration tests, all green
scripts/
  01-issue-assets.sh      # generates identities, wraps YARD + DEMOUSD as SACs
  02-deploy.sh            # builds + deploys + initializes the contract
  03-fund-treasury.sh     # mints reserves into the contract
  env.testnet             # output: contract id + SAC ids + identities
web/
  src/app/page.tsx        # Server Component, reads .rs files at build time
  src/components/         # CodeToggle, OnboardCard, SwapCard, TxReceipt, DemoApp
  src/lib/                # contract.ts, wallet.ts, env.ts, shiki.ts
  .env.local              # NEXT_PUBLIC_* contract addresses
```

## Reproduce

Prereqs: `rustup` (with `wasm32v1-none` target), `stellar` CLI ≥ 26.0,
Node ≥ 20.

```bash
# 1. Compile + test the contract
cargo test --manifest-path contracts/onboard_swap/Cargo.toml
cargo build --manifest-path contracts/onboard_swap/Cargo.toml --features legacy
stellar contract build

# 2. Deploy to testnet (creates Friendbot-funded identities first time)
./scripts/01-issue-assets.sh
./scripts/02-deploy.sh
./scripts/03-fund-treasury.sh
# -> writes scripts/env.testnet with CONTRACT_ID + SAC ids

# 3. Mirror the addresses into the web env (already done; redo if you redeploy)
#    web/.env.local NEXT_PUBLIC_CONTRACT_ID etc.

# 4. Run the dApp
cd web && npm install && npm run dev
# -> http://localhost:3000
```

Smoke-test the contract directly without the frontend:

```bash
source scripts/env.testnet
stellar contract invoke --id "$CONTRACT_ID" --source-account yardstick-user --network testnet \
  -- onboard --new_user "$USER_PK"
stellar contract invoke --id "$CONTRACT_ID" --source-account yardstick-user --network testnet \
  -- swap --user "$USER_PK" --sell_yard true --in_amount 50000000 --min_out 0
```

## Demo walkthrough

What the page shows, in order:

1. **The diff.** Toggle between *Pre-Yardstick* and *Post-Yardstick* on
   the same Rust source. The `trust()` calls and the unchecked-to-checked
   math shift are the parts that changed.
2. **Onboard.** Single contract call → one tx hash on Stellar Expert
   that mints both trustlines and both starter balances atomically.
   Pre-Yardstick this required three separate classic operations.
3. **Swap.** Constant-product YARD ↔ DEMOUSD swap, priced via
   `U256::checked_mul`.
4. **Try to break it.** Feeds the contract inputs that overflow U256.
   Post-Yardstick the contract returns `SwapError::Overflow` and
   the rest of the dApp keeps working. Pre-Yardstick the same call
   would have trapped the entire transaction with no recovery path.

Testnet has been on Yardstick since 2026-04-16 and mainnet since
2026-05-06, so anything you build on top of this works on both today.

## Verified APIs (soroban-sdk 26.0.0)

| Capability | Symbol |
|---|---|
| SAC trust on G-account | `token::StellarAssetClient::trust(&addr)` |
| Native SAC transfer (auto-creates AccountEntry) | `token::Client::transfer(&from, &to, &amount)` against the native SAC |
| Checked 256-bit math | `U256::checked_add(&self, &U256) -> Option<U256>`, same for `checked_sub`/`checked_mul`/`checked_pow` |

Specs: [CAP-0073](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0073.md)
· [CAP-0082](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0082.md)
