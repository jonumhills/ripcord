"use client";

import { useState } from "react";
import { connectWallet } from "@/lib/chain";
import { notifyExtensionOfConnectedWallet } from "@/lib/extensionBridge";

/**
 * Opened by the extension (chrome.tabs.create) because a popup page never gets window.ethereum
 * injected. This is a normal tab, so wallet connect works like any dapp — once connected, we
 * message the address back to the extension via chrome.runtime.sendMessage (see lib/extensionBridge.ts).
 */
export default function ConnectPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      notifyExtensionOfConnectedWallet(addr);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="wrap py-24 max-w-md">
      <span className="label-caps">Ripcord</span>
      <h1 className="font-display font-semibold text-2xl mt-3">Connect your wallet</h1>
      <p className="text-muted mt-3 leading-relaxed">
        {address
          ? "Connected — you can close this tab and return to the extension."
          : "This confirms your address with the Ripcord extension."}
      </p>

      {!address && (
        <button className="btn btn-primary mt-6" onClick={handleConnect}>
          Connect wallet
        </button>
      )}

      {address && (
        <div className="card card-accent fade-in-up mt-6 flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          <div>
            <span className="label-caps text-primary">Connected</span>
            <p className="font-mono text-sm mt-1">{address}</p>
          </div>
        </div>
      )}

      {error && <p className="text-no-bg text-sm mt-4">{error}</p>}
    </main>
  );
}
