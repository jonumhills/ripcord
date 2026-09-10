"use client";

import { useState } from "react";
import { connectWallet } from "@/lib/chain";

interface Props {
  addresses: string[];
  onAddAddress: (address: string) => void;
  onRemoveAddress: (address: string) => void;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function AddressForm({ addresses, onAddAddress, onRemoveAddress }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(addr: string) {
    const trimmed = addr.trim().toLowerCase();
    if (!ADDRESS_RE.test(trimmed)) {
      setError("Enter a valid EVM address (0x… 40 hex chars)");
      return;
    }
    if (addresses.includes(trimmed)) {
      setError("Already added");
      return;
    }
    onAddAddress(trimmed);
    setInput("");
    setError(null);
  }

  async function handleConnect() {
    try {
      const addr = await connectWallet();
      add(addr);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Add wallets</h2>
        <p className="label-caps mt-1">You don't need the keys — insure any address</p>
      </div>

      <div className="flex gap-3">
        <button className="btn btn-secondary" onClick={handleConnect}>
          Connect wallet
        </button>
        <div className="flex-1 flex gap-2">
          <input
            className="input"
            placeholder="or paste an address — 0x…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add(input)}
          />
          <button className="btn btn-primary" onClick={() => add(input)}>
            Add
          </button>
        </div>
      </div>
      {error && <p className="text-no-bg text-sm">{error}</p>}

      {addresses.length > 0 && (
        <div className="flex flex-col gap-2">
          {addresses.map((addr) => (
            <div key={addr} className="flex items-center justify-between bg-surface-2 border border-border rounded py-2 px-3">
              <span className="font-mono text-sm">{addr}</span>
              <button className="text-no-bg text-xs" onClick={() => onRemoveAddress(addr)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
