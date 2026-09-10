import { useEffect, useState } from "react";
import { assessAddresses } from "../lib/api";
import type { AddressRiskScore } from "../lib/types";

interface Props {
  addresses: string[];
  onBack: () => void;
  onContinue: () => void;
}

const TIER_LABEL: Record<AddressRiskScore["tier"], string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  declined: "Not insurable",
};

export function RiskAssessment({ addresses, onBack, onContinue }: Props) {
  const [scores, setScores] = useState<AddressRiskScore[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    assessAddresses(addresses)
      .then((res) => !cancelled && setScores(res.scores))
      .catch((err) => !cancelled && setError(String(err.message ?? err)));
    return () => {
      cancelled = true;
    };
  }, [addresses]);

  const anyInsurable = scores?.some((s) => s.tier !== "declined") ?? false;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Risk assessment</h1>
        <p className="label-caps mt-1">Live from The Graph, GoldRush, ScamSniffer, Sourcify</p>
      </div>

      {!scores && !error && <p className="text-muted text-sm">Scoring {addresses.length} address(es)…</p>}
      {error && <p className="text-no-bg text-sm">{error}</p>}

      {scores?.map((s) => (
        <div key={s.address} className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs">
              {s.address.slice(0, 6)}…{s.address.slice(-4)}
            </span>
            <span className={`badge badge-${s.tier === "declined" ? "declined" : s.tier}`}>
              {TIER_LABEL[s.tier]}
            </span>
          </div>
          <ul className="flex flex-col gap-1">
            {s.reasons.map((reason, i) => (
              <li key={i} className="text-xs text-muted">
                · {reason}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex gap-2 mt-2">
        <button className="btn btn-secondary flex-1" onClick={onBack}>
          ← Back
        </button>
        <button className="btn btn-primary flex-1" disabled={!anyInsurable} onClick={onContinue}>
          Get a quote →
        </button>
      </div>
    </div>
  );
}
