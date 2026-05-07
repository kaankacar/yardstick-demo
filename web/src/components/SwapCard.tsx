"use client";

import { useState } from "react";
import { swap, tryOverflow, type TxReceipt } from "@/lib/contract";

export function SwapCard({
  address,
  onReceipt,
}: {
  address: string | null;
  onReceipt: (r: TxReceipt) => void;
}) {
  const [amount, setAmount] = useState("5");
  const [sellYard, setSellYard] = useState(true);
  const [busy, setBusy] = useState<"swap" | "overflow" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [overflowResult, setOverflowResult] = useState<string | null>(null);

  async function handleSwap() {
    if (!address) return;
    setErr(null);
    setBusy("swap");
    try {
      const inAmount = BigInt(Math.floor(Number(amount) * 10_000_000));
      const r = await swap(address, sellYard, inAmount, 0n);
      onReceipt(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleOverflow() {
    setErr(null);
    setOverflowResult(null);
    setBusy("overflow");
    try {
      const r = await tryOverflow();
      if (r.kind === "overflow") {
        setOverflowResult(
          "✓ Contract returned SwapError::Overflow gracefully. Pre-Yardstick the same call would have trapped the entire transaction — no recovery, no typed error.",
        );
      } else {
        setOverflowResult(
          `Got ${r.value.toString()} (no overflow this run — try larger inputs).`,
        );
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-zinc-100">2. Swap</h3>
        <span className="text-xs text-zinc-400">CAP-82</span>
      </div>
      <p className="text-sm text-zinc-400 mb-4">
        Constant-product AMM, pricing via <code>U256::checked_mul</code>. The
        “try to break it” button feeds in inputs that would overflow U256 —
        Yardstick returns a typed error instead of trapping.
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100"
          placeholder="amount"
        />
        <button
          onClick={() => setSellYard((v) => !v)}
          className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-3 py-2 text-sm font-mono"
        >
          {sellYard ? "YARD → DEMOUSD" : "DEMOUSD → YARD"}
        </button>
      </div>

      <button
        onClick={handleSwap}
        disabled={!address || busy !== null}
        className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2.5 disabled:opacity-50"
      >
        {!address
          ? "Connect + onboard first"
          : busy === "swap"
            ? "Submitting swap..."
            : "Swap"}
      </button>

      <div className="mt-4 pt-4 border-t border-zinc-800">
        <button
          onClick={handleOverflow}
          disabled={busy !== null}
          className="w-full rounded-lg bg-amber-500/90 hover:bg-amber-400 text-black font-semibold py-2 text-sm disabled:opacity-50"
        >
          {busy === "overflow"
            ? "Trying to overflow U256..."
            : "Try to break it (overflow demo)"}
        </button>
        {overflowResult && (
          <div className="mt-3 text-xs text-amber-300 bg-amber-500/10 rounded-md p-3 leading-relaxed">
            {overflowResult}
          </div>
        )}
      </div>

      {err && (
        <div className="mt-3 text-xs text-red-400 break-words">{err}</div>
      )}
    </div>
  );
}
