import type { Quote } from "@/lib/types";

const USDC_DECIMALS = 6;

function formatUsdc(raw: string): string {
  const n = Number(raw) / 10 ** USDC_DECIMALS;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

interface Props {
  quote: Quote;
  coverageCapUsd: number;
  onCoverageCapChange: (v: number) => void;
}

export function QuotePanel({ quote, coverageCapUsd, onCoverageCapChange }: Props) {
  return (
    <div className="card fade-in-up flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <span className="label-caps">Coverage per address</span>
          <span className="font-mono text-primary">${coverageCapUsd.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={10}
          max={10000}
          step={10}
          value={coverageCapUsd}
          onChange={(e) => onCoverageCapChange(Number(e.target.value))}
          className="w-full accent-primary mt-3"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        {quote.items.map((item) => (
          <div key={item.address} className="flex items-center justify-between text-sm gap-3">
            <span className="font-mono text-muted truncate">{item.address}</span>
            <span className={`shrink-0 ${item.tier === "declined" ? "text-no-bg" : "text-fg"}`}>
              {item.tier === "declined" ? "Declined" : `$${formatUsdc(item.premium)}/yr`}
            </span>
          </div>
        ))}
        {Number(quote.bundleDiscount) > 0 && (
          <div className="flex items-center justify-between text-sm text-muted">
            <span>Bundle discount</span>
            <span>-${formatUsdc(quote.bundleDiscount)} USDC</span>
          </div>
        )}
      </div>

      {/* The number the whole screen is building toward — given its own visual weight rather
          than sitting flush with the line items above it. */}
      <div className="rounded-md bg-surface-2 border border-border px-5 py-4 flex items-center justify-between">
        <div>
          <span className="label-caps">Total premium / year</span>
          <p className="font-display text-3xl text-primary mt-1">${formatUsdc(quote.totalPremium)}</p>
        </div>
        <div className="text-right">
          <span className="label-caps">Coverage</span>
          <p className="text-fg mt-1">${formatUsdc(quote.totalCoverageCap)} USDC</p>
        </div>
      </div>
    </div>
  );
}
