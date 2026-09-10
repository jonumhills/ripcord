import type { AddressRiskScore } from "@/lib/types";

const TIER_LABEL: Record<AddressRiskScore["tier"], string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  declined: "Not insurable",
};

export function RiskCard({ score }: { score: AddressRiskScore }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm">{score.address}</span>
        <span className={`badge badge-${score.tier === "declined" ? "declined" : score.tier}`}>
          {TIER_LABEL[score.tier]}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {score.reasons.map((reason, i) => (
          <li key={i} className="text-sm text-muted">
            · {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
