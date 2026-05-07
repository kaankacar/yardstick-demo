import { Networks } from "@stellar/stellar-sdk";

// Next.js inlines `process.env.NEXT_PUBLIC_*` only when accessed via literal
// property names — dynamic `process.env[name]` becomes `undefined` in the
// browser bundle. So each var has to be referenced explicitly here.
function must(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export const ENV = {
  network: process.env.NEXT_PUBLIC_NETWORK ?? "testnet",
  rpcUrl: must("NEXT_PUBLIC_RPC_URL", process.env.NEXT_PUBLIC_RPC_URL),
  networkPassphrase: must(
    "NEXT_PUBLIC_NETWORK_PASSPHRASE",
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
  ),
  contractId: must(
    "NEXT_PUBLIC_CONTRACT_ID",
    process.env.NEXT_PUBLIC_CONTRACT_ID,
  ),
  nativeSac: must(
    "NEXT_PUBLIC_NATIVE_SAC",
    process.env.NEXT_PUBLIC_NATIVE_SAC,
  ),
  yardSac: must("NEXT_PUBLIC_YARD_SAC", process.env.NEXT_PUBLIC_YARD_SAC),
  demoUsdSac: must(
    "NEXT_PUBLIC_DEMOUSD_SAC",
    process.env.NEXT_PUBLIC_DEMOUSD_SAC,
  ),
  adminPk: must("NEXT_PUBLIC_ADMIN_PK", process.env.NEXT_PUBLIC_ADMIN_PK),
  explorerBase: must(
    "NEXT_PUBLIC_EXPLORER_BASE",
    process.env.NEXT_PUBLIC_EXPLORER_BASE,
  ),
} as const;

export const SDK_NETWORK_PASSPHRASE = Networks.TESTNET;
