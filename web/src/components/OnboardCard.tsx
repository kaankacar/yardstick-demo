"use client";

import { useEffect, useState } from "react";
import { connect } from "@/lib/wallet";
import { isOnboarded, onboard, type TxReceipt } from "@/lib/contract";

export function OnboardCard({
  onReceipt,
}: {
  onReceipt: (r: TxReceipt) => void;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"connect" | "onboard" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    isOnboarded(address)
      .then(setOnboarded)
      .catch((e) => setErr(String(e)));
  }, [address]);

  async function handleConnect() {
    setErr(null);
    setBusy("connect");
    try {
      const a = await connect();
      setAddress(a);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleOnboard() {
    if (!address) return;
    setErr(null);
    setBusy("onboard");
    try {
      const r = await onboard(address);
      onReceipt(r);
      setOnboarded(true);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-zinc-100">1. Onboard</h3>
        <span className="text-xs text-zinc-400">CAP-73</span>
      </div>
      <p className="text-sm text-zinc-400 mb-4">
        One contract call: native-SAC bootstrap → SAC <code>trust()</code>{" "}
        x2 → starter balances. Atomic at the ledger boundary.
      </p>

      {!address ? (
        <button
          onClick={handleConnect}
          disabled={busy !== null}
          className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2.5 disabled:opacity-50"
        >
          {busy === "connect" ? "Opening wallet..." : "Connect Freighter"}
        </button>
      ) : (
        <>
          <div className="text-xs text-zinc-500 mb-3 font-mono break-all">
            {address}
          </div>
          <button
            onClick={handleOnboard}
            disabled={busy !== null || onboarded === true}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2.5 disabled:opacity-50"
          >
            {onboarded === true
              ? "Already onboarded ✓"
              : busy === "onboard"
                ? "Submitting (1 tx, atomic)..."
                : "Onboard me"}
          </button>
        </>
      )}

      {err && (
        <div className="mt-3 text-xs text-red-400 break-words">{err}</div>
      )}
    </div>
  );
}
