"use client";

import {
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
  nativeToScVal,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { ENV, SDK_NETWORK_PASSPHRASE } from "./env";
import { signXdr } from "./wallet";

const server = new rpc.Server(ENV.rpcUrl);

const ONBOARDED_QUERY_ACCOUNT = ENV.adminPk;

function contract(): Contract {
  return new Contract(ENV.contractId);
}

async function buildTx(sourceAddress: string, op: xdr.Operation) {
  const account = await server.getAccount(sourceAddress);
  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: SDK_NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();
}

async function simulateAndAssemble(
  tx: Awaited<ReturnType<typeof buildTx>>,
): Promise<{ assembledXdr: string; raw: rpc.Api.SimulateTransactionResponse }> {
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`simulation failed: ${sim.error}`);
  }
  const assembled = rpc.assembleTransaction(tx, sim).build();
  return { assembledXdr: assembled.toXDR(), raw: sim };
}

async function pollUntilSettled(hash: string): Promise<rpc.Api.GetTransactionResponse> {
  for (let i = 0; i < 60; i++) {
    const r = await server.getTransaction(hash);
    if (r.status !== "NOT_FOUND") return r;
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`tx ${hash} did not settle within 60 s`);
}

export type TxReceipt = {
  hash: string;
  ledger: number;
  result: unknown;
  explorerUrl: string;
};

async function invoke(
  user: string,
  method: string,
  args: xdr.ScVal[],
): Promise<TxReceipt> {
  const op = contract().call(method, ...args);
  const tx = await buildTx(user, op);
  const { assembledXdr } = await simulateAndAssemble(tx);
  const signedXdr = await signXdr(assembledXdr, user);
  const signed = TransactionBuilder.fromXDR(signedXdr, SDK_NETWORK_PASSPHRASE);
  const send = await server.sendTransaction(signed);
  if (send.status !== "PENDING") {
    throw new Error(`sendTransaction returned status ${send.status}`);
  }
  const settled = await pollUntilSettled(send.hash);
  if (settled.status !== "SUCCESS") {
    throw new Error(
      `tx ${send.hash} ended in status ${settled.status}: ${
        "resultXdr" in settled ? settled.resultXdr.toXDR("base64") : ""
      }`,
    );
  }
  const retval =
    "returnValue" in settled && settled.returnValue
      ? scValToNative(settled.returnValue)
      : null;
  return {
    hash: send.hash,
    ledger: settled.ledger,
    result: retval,
    explorerUrl: `${ENV.explorerBase}/tx/${send.hash}`,
  };
}

async function readOnly(method: string, args: xdr.ScVal[]): Promise<unknown> {
  const op = contract().call(method, ...args);
  const tx = await buildTx(ONBOARDED_QUERY_ACCOUNT, op);
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`simulation failed: ${sim.error}`);
  }
  if (!("result" in sim) || !sim.result) {
    throw new Error("simulation returned no result");
  }
  return scValToNative(sim.result.retval);
}

// ---------------------------------------------------------------------------
// Public API used by the React components
// ---------------------------------------------------------------------------

export async function reserves(): Promise<{ yard: bigint; usd: bigint }> {
  const r = (await readOnly("reserves", [])) as [bigint, bigint];
  return { yard: BigInt(r[0]), usd: BigInt(r[1]) };
}

export async function isOnboarded(addr: string): Promise<boolean> {
  return (await readOnly("is_onboarded", [
    new Address(addr).toScVal(),
  ])) as boolean;
}

export async function quote(
  inAmount: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
): Promise<bigint> {
  const r = (await readOnly("quote", [
    nativeToScVal(inAmount, { type: "u256" }),
    nativeToScVal(reserveIn, { type: "u256" }),
    nativeToScVal(reserveOut, { type: "u256" }),
  ])) as bigint;
  return BigInt(r);
}

export async function onboard(user: string): Promise<TxReceipt> {
  return invoke(user, "onboard", [new Address(user).toScVal()]);
}

export async function swap(
  user: string,
  sellYard: boolean,
  inAmount: bigint,
  minOut: bigint,
): Promise<TxReceipt> {
  return invoke(user, "swap", [
    new Address(user).toScVal(),
    nativeToScVal(sellYard, { type: "bool" }),
    nativeToScVal(inAmount, { type: "i128" }),
    nativeToScVal(minOut, { type: "i128" }),
  ]);
}

/**
 * Run `quote` against the live reserves with deliberately huge inputs to
 * exercise the CAP-82 overflow path. Returns the typed contract error rather
 * than throwing if the call returns SwapError::Overflow.
 */
export async function tryOverflow(): Promise<
  { kind: "ok"; value: bigint } | { kind: "overflow"; rawError: string }
> {
  // 2^120, twice — squaring blows past U256::MAX.
  const huge = 1n << 120n;
  try {
    const v = await quote(huge, huge, huge);
    return { kind: "ok", value: v };
  } catch (e) {
    const msg = String(e);
    if (msg.includes("Error(Contract, #7)") || msg.includes("Overflow")) {
      return { kind: "overflow", rawError: msg };
    }
    throw e;
  }
}
