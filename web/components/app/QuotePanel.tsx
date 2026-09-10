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
    <div className="card flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between">
          <span className="label-caps">Coverage per address</span>
          <span className="font-mono text-primary">${coverageCapUsd.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={100}
          max={10000}
          step={100}
          value={coverageCapUsd}
          onChange={(e) => onCoverageCapChange(Number(e.target.value))}
          className="w-full accent-primary mt-2"
        />
      </div>

      <div className="flex flex-col gap-2">
        {quote.items.map((item) => (
          <div key={item.address} className="flex items-center justify-between text-sm">
            <span className="font-mono text-muted">{item.address}</span>
            <span className={item.tier === "declined" ? "text-no-bg" : "text-fg"}>
              {item.tier === "declined" ? "Declined" : `$${formatUsdc(item.premium)} USDC/yr`}
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

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between">
        <span className="label-caps">Total premium</span>
        <span className="font-display text-2xl text-primary">${formatUsdc(quote.totalPremium)} USDC/yr</span>
      </div>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Total coverage</span>
        <span>${formatUsdc(quote.totalCoverageCap)} USDC</span>
      </div>
    </div>
  );
}
