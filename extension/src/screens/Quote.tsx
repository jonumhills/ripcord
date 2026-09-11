import { useEffect, useState } from "react";
import { getQuote } from "../lib/api";
import type { Quote as QuoteType } from "../lib/types";

interface Props {
  addresses: string[];
  onBack: () => void;
}

const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL ?? "http://localhost:3000";
const USDC_DECIMALS = 6;

function formatUsdc(raw: string): string {
  const n = Number(raw) / 10 ** USDC_DECIMALS;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function Quote({ addresses, onBack }: Props) {
  const [coverageCapUsd, setCoverageCapUsd] = useState(10); // slider min — cheapest possible premium for testing; drag up for a realistic quote
  const [quote, setQuote] = useState<QuoteType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getQuote(addresses, coverageCapUsd)
      .then((res) => !cancelled && setQuote(res.quote))
      .catch((err) => !cancelled && setError(String(err.message ?? err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // Refetch on every slider change — quotes are cheap to compute and risk data moves, so we don't cache.
  }, [addresses, coverageCapUsd]);

  function handleGetCovered() {
    // Binding needs an on-chain signature, which — same as wallet connect — the popup can't do
    // directly. Hand off to the full web checkout flow with the quote parameters in the URL.
    const params = new URLSearchParams({
      addresses: addresses.join(","),
      coverageCapUsd: String(coverageCapUsd),
    });
    chrome.tabs.create({ url: `${WEB_APP_URL}/bind?${params.toString()}` });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Your quote</h1>
        <p className="label-caps mt-1">Annual premium, per-address risk-priced</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label-caps">Coverage per address</span>
          <span className="font-mono text-sm text-primary">${coverageCapUsd.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={10}
          max={10000}
          step={10}
          value={coverageCapUsd}
          onChange={(e) => setCoverageCapUsd(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {loading && <p className="text-muted text-sm">Pricing…</p>}
      {error && <p className="text-no-bg text-sm">{error}</p>}

      {quote && (
        <div className="card flex flex-col gap-2">
          {quote.items.map((item) => (
            <div key={item.address} className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted">
                {item.address.slice(0, 6)}…{item.address.slice(-4)}
              </span>
              <span className={item.tier === "declined" ? "text-no-bg" : "text-fg"}>
                {item.tier === "declined" ? "Declined" : `$${formatUsdc(item.premium)} USDC/yr`}
              </span>
            </div>
          ))}

          {Number(quote.bundleDiscount) > 0 && (
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Bundle discount</span>
              <span>-${formatUsdc(quote.bundleDiscount)} USDC</span>
            </div>
          )}

          <div className="h-px bg-border my-1" />

          <div className="flex items-center justify-between">
            <span className="label-caps">Total premium</span>
            <span className="font-display text-lg text-primary">${formatUsdc(quote.totalPremium)} USDC/yr</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Total coverage</span>
            <span>${formatUsdc(quote.totalCoverageCap)} USDC</span>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <button className="btn btn-secondary flex-1" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn btn-primary flex-1"
          disabled={!quote || Number(quote.totalPremium) === 0}
          onClick={handleGetCovered}
        >
          Get covered →
        </button>
      </div>
    </div>
  );
}
