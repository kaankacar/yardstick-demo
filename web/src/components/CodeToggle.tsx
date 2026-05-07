"use client";

import { useState } from "react";

type Variant = "post" | "legacy";

export function CodeToggle({
  postHtml,
  legacyHtml,
}: {
  postHtml: string;
  legacyHtml: string;
}) {
  const [variant, setVariant] = useState<Variant>("post");
  const html = variant === "post" ? postHtml : legacyHtml;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <div className="text-sm text-zinc-400">
          <span className="font-mono">contracts/onboard_swap/src/</span>
          <span className="font-mono text-zinc-200">
            {variant === "post" ? "lib.rs" : "contract_legacy.rs"}
          </span>
        </div>
        <div className="flex gap-1 rounded-lg bg-zinc-800 p-1 text-xs">
          <button
            onClick={() => setVariant("legacy")}
            className={`px-3 py-1 rounded-md transition ${
              variant === "legacy"
                ? "bg-amber-500/90 text-black font-semibold"
                : "text-zinc-300 hover:text-white"
            }`}
          >
            Pre-Yardstick
          </button>
          <button
            onClick={() => setVariant("post")}
            className={`px-3 py-1 rounded-md transition ${
              variant === "post"
                ? "bg-emerald-500/90 text-black font-semibold"
                : "text-zinc-300 hover:text-white"
            }`}
          >
            Post-Yardstick
          </button>
        </div>
      </header>
      <div
        className="text-xs leading-5 max-h-[36rem] overflow-auto p-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <footer className="px-4 py-2 text-xs text-zinc-500 border-t border-zinc-800 bg-zinc-900/40">
        {variant === "post" ? (
          <>
            <span className="text-emerald-400">●</span> Real, deployed code.
            Uses <code className="text-zinc-300">StellarAssetClient::trust()</code>{" "}
            (CAP-73) and <code className="text-zinc-300">U256::checked_mul()</code>{" "}
            (CAP-82) — host functions added in Yardstick.
          </>
        ) : (
          <>
            <span className="text-amber-400">●</span> Display only — never
            deployed. Trustlines had to be created off-chain via classic{" "}
            <code className="text-zinc-300">ChangeTrust</code> ops, and unchecked{" "}
            <code className="text-zinc-300">U256::mul</code> traps the whole
            transaction on overflow.
          </>
        )}
      </footer>
    </section>
  );
}
