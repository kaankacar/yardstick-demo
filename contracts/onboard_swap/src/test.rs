#![cfg(test)]

use super::{OnboardSwap, OnboardSwapClient, SwapError};
use soroban_sdk::{testutils::Address as _, token, Address, Env, U256};

struct Setup<'a> {
    env: Env,
    admin: Address,
    contract: Address,
    client: OnboardSwapClient<'a>,
    yard_sac: Address,
    usd_sac: Address,
    native_sac: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    // Three SACs: native-proxy (stands in for the XLM SAC in unit tests), YARD, USD.
    let native = env.register_stellar_asset_contract_v2(admin.clone());
    let yard = env.register_stellar_asset_contract_v2(admin.clone());
    let usd = env.register_stellar_asset_contract_v2(admin.clone());

    let contract = env.register(OnboardSwap, ());
    let client = OnboardSwapClient::new(&env, &contract);

    client.initialize(
        &admin,
        &native.address(),
        &yard.address(),
        &usd.address(),
    );

    // Fund the contract's treasury so it can hand out XLM + tokens during onboard.
    let native_admin = token::StellarAssetClient::new(&env, &native.address());
    let yard_admin = token::StellarAssetClient::new(&env, &yard.address());
    let usd_admin = token::StellarAssetClient::new(&env, &usd.address());
    native_admin.mint(&contract, &1_000_000_000_000); // 100k XLM
    yard_admin.mint(&contract, &1_000_000_000_000); // 100k YARD reserve
    usd_admin.mint(&contract, &1_000_000_000_000); // 100k DEMO_USD reserve

    Setup {
        env,
        admin,
        contract,
        client,
        yard_sac: yard.address(),
        usd_sac: usd.address(),
        native_sac: native.address(),
    }
}

#[test]
fn onboard_creates_trustlines_and_mints_starter_balances() {
    let s = setup();
    let user = Address::generate(&s.env);

    s.client.onboard(&user);

    // Starter balances visible on each SAC.
    let yard = token::Client::new(&s.env, &s.yard_sac);
    let usd = token::Client::new(&s.env, &s.usd_sac);
    let native = token::Client::new(&s.env, &s.native_sac);
    assert_eq!(yard.balance(&user), 1_000_000_000);
    assert_eq!(usd.balance(&user), 1_000_000_000);
    assert_eq!(native.balance(&user), 10_000_000);
    assert!(s.client.is_onboarded(&user));
}

#[test]
fn second_onboard_returns_already_onboarded_not_panic() {
    let s = setup();
    let user = Address::generate(&s.env);
    s.client.onboard(&user);

    let err = s.client.try_onboard(&user).err().unwrap().unwrap();
    assert_eq!(err, SwapError::AlreadyOnboarded);
}

#[test]
fn quote_returns_constant_product_output() {
    let s = setup();
    let in_amount = U256::from_u128(&s.env, 100_000_000); // 10 YARD
    let reserve_in = U256::from_u128(&s.env, 1_000_000_000_000);
    let reserve_out = U256::from_u128(&s.env, 1_000_000_000_000);
    let out = s.client.quote(&in_amount, &reserve_in, &reserve_out);

    // out = in*r_out / (r_in+in) ≈ in (when reserves >> in and equal)
    let out_u128 = out.to_u128().unwrap();
    assert!(out_u128 > 0);
    assert!(out_u128 < 100_000_000); // strictly less than `in_amount` after curve fee
}

#[test]
fn quote_overflow_returns_typed_error_not_trap() {
    // CAP-82: the headline post-Yardstick behavior — overflow is a recoverable
    // typed error, not a transaction-killing trap.
    let s = setup();

    // 2^200 is well within U256 range, but 2^200 * 2^200 = 2^400 overflows.
    let huge = U256::from_u128(&s.env, 1u128 << 100)
        .checked_mul(&U256::from_u128(&s.env, 1u128 << 100))
        .unwrap();

    let err = s
        .client
        .try_quote(&huge, &huge, &huge)
        .err()
        .unwrap()
        .unwrap();
    assert_eq!(err, SwapError::Overflow);
}

#[test]
fn swap_yard_for_usd_round_trip_conserves_invariant() {
    let s = setup();
    let user = Address::generate(&s.env);
    s.client.onboard(&user);

    let yard = token::Client::new(&s.env, &s.yard_sac);
    let usd = token::Client::new(&s.env, &s.usd_sac);

    let yard_in = 50_000_000i128; // 5 YARD
    let usd_out = s.client.swap(&user, &true, &yard_in, &0i128);
    assert!(usd_out > 0);

    let yard_after = yard.balance(&user);
    let usd_after = usd.balance(&user);
    assert_eq!(yard_after, 1_000_000_000 - yard_in);
    assert_eq!(usd_after, 1_000_000_000 + usd_out);
}

#[test]
fn swap_with_min_out_too_high_fails_slippage() {
    let s = setup();
    let user = Address::generate(&s.env);
    s.client.onboard(&user);

    let unrealistic_min_out = 999_999_999_999i128;
    let err = s
        .client
        .try_swap(&user, &true, &50_000_000, &unrealistic_min_out)
        .err()
        .unwrap()
        .unwrap();
    assert_eq!(err, SwapError::SlippageExceeded);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")] // SwapError::AlreadyInitialized = 2
fn double_initialize_panics_already_initialized() {
    let s = setup();
    s.client
        .initialize(&s.admin, &s.native_sac, &s.yard_sac, &s.usd_sac);
}
