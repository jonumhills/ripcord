"use client";

import { useState } from "react";
import { ClaimPanel } from "./ClaimPanel";
import type { Policy } from "@/lib/types";

const USDC_DECIMALS = 6;
function formatUsdc(raw: string) {
  return (Number(raw) / 10 ** USDC_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function shortAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Lets you file a claim straight from the dashboard's Claims tab, instead of having to first
 * find and open the specific policy that covers the drained wallet. With one active policy this
 * just shows which one you're filing against; with more than one, a picker sits above the same
 * ClaimPanel used on the policy detail page — same checklist, same reasoning, same payout flow,
 * just reachable from one place without navigating away first.
 */
export function FileClaimCard({ policies, onPaid }: { policies: Policy[]; onPaid: () => void }) {
  const [selectedId, setSelectedId] = useState(policies[0]?.id ?? "");

  if (policies.length === 0) {
    return (
      <div className="card flex flex-col items-start gap-2">
        <span className="label-caps">File a claim</span>
        <p className="text-muted text-sm leading-relaxed">
          You don't have an active policy to claim against yet.{" "}
          <a href="/app" className="text-primary hover:underline">
            Get covered first →
          </a>
        </p>
      </div>
    );
  }

  const selected = policies.find((p) => p.id === selectedId) ?? policies[0];

  return (
    <div className="flex flex-col gap-3">
      {policies.length > 1 && (
        <div className="flex items-center gap-2.5">
          <span className="label-caps shrink-0">Policy</span>
          <select
            className="input !py-2 text-sm font-mono"
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {shortAddress(p.coveredAddresses[0] ?? "")} · ${formatUsdc(p.coverageCap)} cap
              </option>
            ))}
          </select>
        </div>
      )}
      <ClaimPanel key={selected.id} policyId={selected.id} onPaid={onPaid} />
    </div>
  );
}
