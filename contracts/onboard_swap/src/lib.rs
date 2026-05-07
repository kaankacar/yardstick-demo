//! Yardstick (Stellar Protocol 26) demo contract.
//!
//! Combines two new builder capabilities in one ~atomic flow:
//!
//! * **CAP-73** — `StellarAssetClient::trust()` creates the asset's trustline on
//!   a G-account directly from a Soroban contract. Combined with the native
//!   SAC's "transfer-to-non-existent-account" path, the contract can bring a
//!   brand-new user fully online in a single host invocation.
//!
//! * **CAP-82** — `U256::checked_mul` / `checked_add` return `Option<U256>` on
//!   overflow instead of trapping the whole transaction, so DeFi pricing logic
//!   can degrade gracefully instead of bricking the user's tx.
//!
//! See `contract_legacy.rs` for the pre-Yardstick equivalent (display only).

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, token, Address, Env, U256,
};

mod errors;
pub use errors::SwapError;

#[cfg(any(test, feature = "legacy"))]
mod contract_legacy;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub struct Config {
    /// Native XLM SAC (`stellar contract id asset --asset native`).
    pub native_sac: Address,
    pub yard_sac: Address,
    pub usd_sac: Address,
    pub admin: Address,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Cfg,
    Onboarded(Address),
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/// 1 XLM in stroops. Enough to cover the new G-account's base reserve so that
/// the native-SAC transfer auto-creates the `AccountEntry` (CAP-73 §"transfer
/// to non-existent account").
const XLM_BOOTSTRAP: i128 = 10_000_000;

/// Starter balances minted to onboarded users (7-decimal, classic-asset style).
const ONBOARD_YARD: i128 = 1_000_000_000; // 100 YARD
const ONBOARD_USD: i128 = 1_000_000_000; // 100 DEMO_USD

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct OnboardSwap;

#[contractimpl]
impl OnboardSwap {
    /// One-time setup. Pins the SAC addresses the contract operates against.
    pub fn initialize(
        env: Env,
        admin: Address,
        native_sac: Address,
        yard_sac: Address,
        usd_sac: Address,
    ) {
        if env.storage().instance().has(&DataKey::Cfg) {
            panic_with_error!(&env, SwapError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(
            &DataKey::Cfg,
            &Config {
                native_sac,
                yard_sac,
                usd_sac,
                admin,
            },
        );
    }

    /// Atomic onboarding — the demo's headline feature.
    ///
    /// Performs three CAP-73-flavored host calls in one Soroban invocation:
    ///   1. Native SAC `transfer` to the new G-address. If the address has no
    ///      `AccountEntry` yet and the amount covers the base reserve, the host
    ///      auto-creates the account.
    ///   2. `StellarAssetClient::trust(addr)` on each demo SAC — creates the
    ///      trustline directly, no classic `ChangeTrust` op needed.
    ///   3. Treasury transfers the starter balances.
    ///
    /// Pre-Yardstick this required at minimum: 1× CreateAccount, 2× ChangeTrust
    /// signed by the new account, then 2× Payment from the issuer — all as
    /// separate classic ops, none of which could be atomic with contract logic.
    pub fn onboard(env: Env, new_user: Address) -> Result<(), SwapError> {
        new_user.require_auth();
        let cfg = Self::cfg(&env);

        let key = DataKey::Onboarded(new_user.clone());
        if env.storage().persistent().has(&key) {
            return Err(SwapError::AlreadyOnboarded);
        }

        let contract = env.current_contract_address();

        // (1) CAP-73: native SAC transfer creates the AccountEntry if missing.
        token::Client::new(&env, &cfg.native_sac)
            .transfer(&contract, &new_user, &XLM_BOOTSTRAP);

        // (2) CAP-73: SAC.trust() creates the trustline on the G-account.
        token::StellarAssetClient::new(&env, &cfg.yard_sac).trust(&new_user);
        token::StellarAssetClient::new(&env, &cfg.usd_sac).trust(&new_user);

        // (3) Treasury sends starter balances over the freshly-minted trustlines.
        token::Client::new(&env, &cfg.yard_sac)
            .transfer(&contract, &new_user, &ONBOARD_YARD);
        token::Client::new(&env, &cfg.usd_sac)
            .transfer(&contract, &new_user, &ONBOARD_USD);

        env.storage().persistent().set(&key, &true);
        Ok(())
    }

    /// Constant-product quote: `out = (in * reserve_out) / (reserve_in + in)`.
    ///
    /// CAP-82 demo: `checked_mul` and `checked_add` return `Option<U256>`. On
    /// overflow we surface a typed `SwapError::Overflow` instead of trapping
    /// the entire transaction, so the dApp can offer the user a smaller trade
    /// without losing the rest of its work.
    pub fn quote(
        env: Env,
        in_amount: U256,
        reserve_in: U256,
        reserve_out: U256,
    ) -> Result<U256, SwapError> {
        let _ = env;
        let numerator = in_amount
            .checked_mul(&reserve_out)
            .ok_or(SwapError::Overflow)?;
        let denominator = reserve_in
            .checked_add(&in_amount)
            .ok_or(SwapError::Overflow)?;
        Ok(numerator.div(&denominator))
    }

    /// Execute a YARD↔DEMO_USD swap against the contract's reserves.
    pub fn swap(
        env: Env,
        user: Address,
        sell_yard: bool,
        in_amount: i128,
        min_out: i128,
    ) -> Result<i128, SwapError> {
        user.require_auth();
        if in_amount <= 0 {
            return Err(SwapError::InvalidAmount);
        }
        let cfg = Self::cfg(&env);
        let contract = env.current_contract_address();

        let yard_reserve = token::Client::new(&env, &cfg.yard_sac).balance(&contract);
        let usd_reserve = token::Client::new(&env, &cfg.usd_sac).balance(&contract);
        let (reserve_in, reserve_out, in_sac, out_sac) = if sell_yard {
            (yard_reserve, usd_reserve, &cfg.yard_sac, &cfg.usd_sac)
        } else {
            (usd_reserve, yard_reserve, &cfg.usd_sac, &cfg.yard_sac)
        };

        let in_u256 = U256::from_u128(&env, in_amount as u128);
        let reserve_in_u256 = U256::from_u128(&env, reserve_in as u128);
        let reserve_out_u256 = U256::from_u128(&env, reserve_out as u128);

        // CAP-82 checked path. Same shape as the math you'd write in any AMM,
        // but a transaction-killing overflow becomes a recoverable error.
        let out_u256 = Self::quote(env.clone(), in_u256, reserve_in_u256, reserve_out_u256)?;
        let out_u128 = out_u256.to_u128().ok_or(SwapError::Overflow)?;
        let out_i128: i128 = out_u128 as i128;

        if out_i128 < min_out {
            return Err(SwapError::SlippageExceeded);
        }
        if out_i128 == 0 || out_i128 >= reserve_out {
            return Err(SwapError::InsufficientLiquidity);
        }

        token::Client::new(&env, in_sac).transfer(&user, &contract, &in_amount);
        token::Client::new(&env, out_sac).transfer(&contract, &user, &out_i128);
        Ok(out_i128)
    }

    /// Read-only helper for the dApp UI: current reserve balances (yard, usd).
    pub fn reserves(env: Env) -> (i128, i128) {
        let cfg = Self::cfg(&env);
        let contract = env.current_contract_address();
        let yard = token::Client::new(&env, &cfg.yard_sac).balance(&contract);
        let usd = token::Client::new(&env, &cfg.usd_sac).balance(&contract);
        (yard, usd)
    }

    pub fn config(env: Env) -> Config {
        Self::cfg(&env)
    }

    pub fn is_onboarded(env: Env, who: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Onboarded(who))
    }
}

impl OnboardSwap {
    fn cfg(env: &Env) -> Config {
        env.storage()
            .instance()
            .get(&DataKey::Cfg)
            .unwrap_or_else(|| panic_with_error!(env, SwapError::NotInitialized))
    }
}

#[cfg(test)]
mod test;
