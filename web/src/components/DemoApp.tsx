"use client";

import { useEffect, useState } from "react";
import { OnboardCard } from "./OnboardCard";
import { SwapCard } from "./SwapCard";
import { TxReceipt } from "./TxReceipt";
import type { TxReceipt as TxReceiptT } from "@/lib/contract";
import { getConnectedAddress } from "@/lib/wallet";

export function DemoApp() {
  const [address, setAddress] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TxReceiptT | null>(null);

  // Poll the kit for the currently connected address so OnboardCard and
  // SwapCard stay in sync without prop-drilling.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const a = await getConnectedAddress();
      if (!cancelled) setAddress(a);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <OnboardCard onReceipt={setReceipt} />
      <SwapCard address={address} onReceipt={setReceipt} />
      <div className="md:col-span-2">
        <TxReceipt receipt={receipt} />
      </div>
    </div>
  );
}
