import { highlightRust } from "@/lib/shiki";
import { CodeToggle } from "@/components/CodeToggle";
import { DemoApp } from "@/components/DemoApp";

import postSource from "../../../contracts/onboard_swap/src/lib.rs";
import legacySource from "../../../contracts/onboard_swap/src/contract_legacy.rs";

export default async function Page() {
  const [postHtml, legacyHtml] = await Promise.all([
    highlightRust(postSource),
    highlightRust(legacySource),
  ]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-400 font-semibold">
            Stellar · Protocol 26 · Yardstick
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            One contract call, brand-new user, safe AMM math.
          </h1>
          <p className="text-zinc-400 max-w-3xl text-lg">
            A live, runnable demo of two new builder capabilities shipped in the
            Yardstick upgrade: <strong>CAP-73</strong> (Soroban contracts can
            create classic accounts &amp; trustlines via the SAC) and{" "}
            <strong>CAP-82</strong> (checked 256-bit math that surfaces overflow
            as a typed error instead of trapping the whole transaction).
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500 pt-1">
            <span className="font-mono">testnet</span>
            <span>·</span>
            <span className="font-mono">soroban-testnet.stellar.org</span>
            <span>·</span>
            <span className="font-mono">soroban-sdk 26</span>
          </div>
        </header>

        <CodeToggle postHtml={postHtml} legacyHtml={legacyHtml} />

        <DemoApp />

        <footer className="text-xs text-zinc-500 pt-6 border-t border-zinc-800 space-y-1">
          <div>
            Source: <code className="text-zinc-400">contracts/onboard_swap/src/lib.rs</code>{" "}
            and <code className="text-zinc-400">contract_legacy.rs</code> are
            both real, compilable Rust — the legacy one is gated behind{" "}
            <code className="text-zinc-400">--features legacy</code> and never
            deployed.
          </div>
          <div>
            Specs:{" "}
            <a
              className="text-emerald-400 hover:text-emerald-300 underline"
              href="https://github.com/stellar/stellar-protocol/blob/master/core/cap-0073.md"
              target="_blank"
              rel="noreferrer"
            >
              CAP-0073
            </a>{" "}
            ·{" "}
            <a
              className="text-emerald-400 hover:text-emerald-300 underline"
              href="https://github.com/stellar/stellar-protocol/blob/master/core/cap-0082.md"
              target="_blank"
              rel="noreferrer"
            >
              CAP-0082
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
