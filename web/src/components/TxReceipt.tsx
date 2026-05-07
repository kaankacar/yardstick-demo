"use client";

import type { TxReceipt as TxReceiptT } from "@/lib/contract";

export function TxReceipt({ receipt }: { receipt: TxReceiptT | null }) {
  if (!receipt) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-5 text-center text-sm text-zinc-500">
        No transactions yet. Connect a wallet and click <strong>Onboard me</strong>.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/10 p-5 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-emerald-300 font-semibold">✓ Tx confirmed</span>
        <span className="text-xs text-zinc-500">ledger {receipt.ledger}</span>
      </div>
      <div className="font-mono text-xs text-zinc-400 break-all mb-2">
        {receipt.hash}
      </div>
      <a
        href={receipt.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-emerald-300 hover:text-emerald-200 underline"
      >
        View on Stellar Expert →
      </a>
      {receipt.result !== null && receipt.result !== undefined && (
        <div className="mt-2 text-xs text-zinc-400">
          returned: <code>{JSON.stringify(receipt.result, (_, v) =>
            typeof v === "bigint" ? v.toString() : v,
          )}</code>
        </div>
      )}
    </div>
  );
}
