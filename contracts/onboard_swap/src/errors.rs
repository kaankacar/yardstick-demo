use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SwapError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    AlreadyOnboarded = 3,
    InvalidAmount = 4,
    InsufficientLiquidity = 5,
    SlippageExceeded = 6,
    /// CAP-82 demo: returned when checked 256-bit math would have overflowed.
    /// Pre-Yardstick the equivalent unchecked op would have trapped the entire tx.
    Overflow = 7,
}
