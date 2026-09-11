import type { AddressRiskScore } from "@/lib/types";

const TIER_LABEL: Record<AddressRiskScore["tier"], string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  declined: "Not insurable",
};

const TIER_FILL: Record<AddressRiskScore["tier"], string> = {
  low: "var(--primary)",
  medium: "var(--kinda-bg)",
  high: "var(--no-bg)",
  declined: "var(--no-bg)",
};

export function RiskCard({ score }: { score: AddressRiskScore }) {
  const fillPct = score.tier === "declined" ? 100 : Math.max(4, score.score);

  return (
    <div className="card fade-in-up flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm truncate">{score.address}</span>
        <span className={`badge badge-${score.tier === "declined" ? "declined" : score.tier} shrink-0`}>
          {TIER_LABEL[score.tier]}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="risk-meter flex-1">
          <div
            className="risk-meter-fill"
            style={{ width: `${fillPct}%`, background: TIER_FILL[score.tier] }}
          />
        </div>
        <span className="label-caps shrink-0">{score.score}/100</span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {score.reasons.map((reason, i) => (
          <li key={i} className="text-sm text-muted leading-relaxed">
            · {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
