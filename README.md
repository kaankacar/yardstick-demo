# Yardstick "So What" Demo

**Live page → https://kaankacar.github.io/yardstick-demo/**
*(testnet, contract `CAM3JG…RGDEF4B`, RPC `soroban-testnet.stellar.org`)*

A minimal, runnable Stellar Yardstick (Protocol 26) demo built for the
Stellar Developers Meeting livestream. Combines two new builder
capabilities in one atomic flow:

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

Hashes from the most recent rehearsal on testnet (`CAM3JG...`):

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

## Livestream talk-track

≈3 minutes:

1. **Hook (15s)**. Open the page. *"Two months ago, onboarding a new user
   into a Stellar dApp meant three classic transactions, off-chain
   choreography, and a window where things could go sideways. As of
   today, on mainnet, it's one contract call."*
2. **Read the diff (45s)**. Toggle Pre-Yardstick → Post-Yardstick. Point
   at the `trust()` calls and the unchecked → `checked_mul` shift.
   Mention CAPs 73 + 82.
3. **Click Onboard (45s)**. Show the tx hash on Stellar Expert. Point at
   the *single* tx that minted both trustlines + funded both balances.
4. **Click Swap (30s)**. Quick "money goes through" moment.
5. **Click "Try to break it" (30s)**. The kill shot. *"Pre-Yardstick this
   would have trapped the entire transaction — your user's tx is dead,
   your dApp's UI is in an inconsistent state, no recovery. Post-Yardstick,
   it's a typed error you handle however you want."*
6. **Close (15s)**. Point at the GitHub link, mention testnet has been on
   Yardstick since 2026-04-16, point builders at the CAP specs.

## Verified APIs (soroban-sdk 26.0.0)

| Capability | Symbol |
|---|---|
| SAC trust on G-account | `token::StellarAssetClient::trust(&addr)` |
| Native SAC transfer (auto-creates AccountEntry) | `token::Client::transfer(&from, &to, &amount)` against the native SAC |
| Checked 256-bit math | `U256::checked_add(&self, &U256) -> Option<U256>`, same for `checked_sub`/`checked_mul`/`checked_pow` |

Specs: [CAP-0073](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0073.md)
· [CAP-0082](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0082.md)
