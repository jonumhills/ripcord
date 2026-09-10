import { useState } from "react";
import { openWalletConnectTab } from "../lib/wallet";

interface Props {
  addresses: string[];
  onAddAddress: (address: string) => void;
  onRemoveAddress: (address: string) => void;
  onContinue: () => void;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function Onboarding({ addresses, onAddAddress, onRemoveAddress, onContinue }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const trimmed = input.trim();
    if (!ADDRESS_RE.test(trimmed)) {
      setError("Enter a valid EVM address (0x…40 hex chars)");
      return;
    }
    if (addresses.includes(trimmed.toLowerCase())) {
      setError("Already added");
      return;
    }
    onAddAddress(trimmed.toLowerCase());
    setInput("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Add wallets</h1>
        <p className="label-caps mt-1">You don't need the keys — insure any address</p>
      </div>

      <button className="btn btn-secondary" onClick={openWalletConnectTab}>
        Connect wallet
      </button>

      <div className="flex items-center gap-2 text-muted text-xs">
        <div className="h-px flex-1 bg-border" />
        or paste an address
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex gap-2">
        <input
          className="input"
          placeholder="0x…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button className="btn btn-primary" onClick={handleAdd}>
          Add
        </button>
      </div>
      {error && <p className="text-no-bg text-xs">{error}</p>}

      {addresses.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="label-caps">
            {addresses.length} address{addresses.length > 1 ? "es" : ""} added
          </span>
          {addresses.map((addr) => (
            <div key={addr} className="card flex items-center justify-between py-2 px-3">
              <span className="font-mono text-xs">
                {addr.slice(0, 6)}…{addr.slice(-4)}
              </span>
              <button className="text-no-bg text-xs" onClick={() => onRemoveAddress(addr)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-primary mt-2" disabled={addresses.length === 0} onClick={onContinue}>
        Check risk →
      </button>
    </div>
  );
}
