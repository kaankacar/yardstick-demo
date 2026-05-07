//! ──────────────────────────────────────────────────────────────────────────
//! PRE-YARDSTICK contract — DISPLAY ONLY.  Never deployed.
//!
//! This file exists so the demo page can render real, compilable Rust source
//! side-by-side with the post-Yardstick version. It mirrors the shape of
//! `lib.rs` but uses only Protocol-25-era APIs:
//!
//!   * No `StellarAssetClient::trust()` — that host function is brand new in
//!     CAP-73. Trustlines had to be created off-chain via classic
//!     `ChangeTrust` ops, signed by the user, BEFORE this contract could do
//!     anything useful for them. Account creation needed a separate classic
//!     `CreateAccount` op too. None of it could be atomic with contract logic.
//!
//!   * No `U256::checked_mul` / `checked_add` — CAP-82 added them. The
//!     unchecked methods below still exist post-Yardstick, but on overflow
//!     they trap, killing the entire transaction with no recovery path.
//!
//! Compiled by `cargo build --features legacy` so we can prove the source is
//! real, not a string in the frontend.
//! ──────────────────────────────────────────────────────────────────────────

#![allow(dead_code)]

use soroban_sdk::{contract, contractimpl, contracttype, panic_with_error, token, Address, Env, U256};

use crate::errors::SwapError;

#[contracttype]
#[derive(Clone)]
pub struct LegacyConfig {
    pub yard_sac: Address,
    pub usd_sac: Address,
    pub admin: Address,
}

#[contracttype]
#[derive(Clone)]
enum LegacyKey {
    Cfg,
}

#[contract]
pub struct OnboardSwapLegacy;

#[contractimpl]
impl OnboardSwapLegacy {
    pub fn initialize(env: Env, admin: Address, yard_sac: Address, usd_sac: Address) {
        if env.storage().instance().has(&LegacyKey::Cfg) {
            panic_with_error!(&env, SwapError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(
            &LegacyKey::Cfg,
            &LegacyConfig { yard_sac, usd_sac, admin },
        );
    }

    /// Pre-Yardstick "onboard" — limited to sending starter balances.
    ///
    /// PREREQUISITES (handled off-chain by the dApp before calling this):
    ///   1. The user's G-account must already exist.
    ///        → Submit a classic `CreateAccount` op funded by the dApp's
    ///          sponsor account, signed by the sponsor.
    ///   2. The user must hold trustlines for YARD and DEMO_USD.
    ///        → Submit classic `ChangeTrust` ops, signed by the user.
    ///
    /// Three separate transactions, each with its own latency and failure
    /// mode, none atomic with the swap below. The contract has no way to
    /// guarantee these prerequisites — if the user closes the tab between
    /// step 1 and step 2, the dApp is in an inconsistent state.
    pub fn onboard(env: Env, new_user: Address) -> Result<(), SwapError> {
        new_user.require_auth();
        let cfg = Self::cfg(&env);
        let contract = env.current_contract_address();

        // The contract can ONLY do this final step. Steps 1-2 happened off-chain.
        token::Client::new(&env, &cfg.yard_sac)
            .transfer(&contract, &new_user, &1_000_000_000);
        token::Client::new(&env, &cfg.usd_sac)
            .transfer(&contract, &new_user, &1_000_000_000);
        Ok(())
    }

    /// Pre-Yardstick quote — UNCHECKED 256-bit math.
    ///
    /// Reads identically to the post-Yardstick version EXCEPT this can trap.
    /// If `in_amount * reserve_out` overflows U256, the host aborts the
    /// transaction. The user sees a generic failure, the dApp loses its
    /// state, and there's no way for the contract to offer a smaller trade.
    pub fn quote(
        env: Env,
        in_amount: U256,
        reserve_in: U256,
        reserve_out: U256,
    ) -> U256 {
        let _ = env;
        // Unchecked: traps on overflow. No Result, no Option, no recovery.
        let numerator = in_amount.mul(&reserve_out);
        let denominator = reserve_in.add(&in_amount);
        numerator.div(&denominator)
    }
}

impl OnboardSwapLegacy {
    fn cfg(env: &Env) -> LegacyConfig {
        env.storage()
            .instance()
            .get(&LegacyKey::Cfg)
            .unwrap_or_else(|| panic_with_error!(env, SwapError::NotInitialized))
    }
}
