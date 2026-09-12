"use client";

import { useState } from "react";
import { TxChecklist, type TxStep } from "./TxChecklist";
import { submitClaim } from "@/lib/api";
import type { Claim } from "@/lib/types";

const EXPLORER_TX_BASE = "https://testnet.arcscan.app/tx/";

function checksToSteps(claim: Claim): TxStep[] {
  return (claim.checks ?? []).map((c, i) => ({
    id: String(i),
    label: c.label,
    status: c.passed ? "done" : "error",
    detail: c.detail,
  }));
}

/**
 * The real claims process: paste a transaction hash, the adjuster independently reads it from
 * Arc and decides — every check it ran shows up here, in order, whether it passed or failed,
 * followed by the reasoning it assembled from what it actually found. Not a black box "approved"
 * or "denied" — the same checklist pattern TxChecklist already uses for the bind flow, reused
 * here for the same reason: showing your work is more convincing than a verdict alone.
 */
export function ClaimPanel({ policyId, onPaid }: { policyId: string; onPaid: () => void }) {
  const [txHash, setTxHash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setClaim(null);
    try {
      const { claim: result } = await submitClaim(policyId, txHash);
      setClaim(result);
      if (result.status === "paid") onPaid();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const approved = claim?.verdict === "approved";

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <span className="label-caps">File a claim</span>
        <p className="text-xs text-muted mt-1.5 leading-relaxed">
          Paste the transaction hash of the transfer you believe drained this wallet. The adjuster
          reads it directly from Arc and decides instantly — no form to review later, no waiting
          on a person.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          className="input"
          placeholder="Transaction hash — 0x…"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
        />
        <button className="btn btn-primary shrink-0" disabled={!txHash || submitting} onClick={handleSubmit}>
          {submitting ? "Reviewing…" : "Submit for review →"}
        </button>
      </div>

      {error && <p className="text-no-bg text-sm">{error}</p>}

      {claim && (
        <div className="pt-3 mt-1 border-t border-border flex flex-col gap-4 fade-in-up">
          <TxChecklist steps={checksToSteps(claim)} />

          <div
            className="rounded-md bg-surface-2 border px-4 py-3.5"
            style={{ borderColor: approved ? "var(--primary)" : "var(--no-bg)" }}
          >
            <span className={`label-caps ${approved ? "text-primary" : "text-no-bg"}`}>
              {approved ? "Approved" : "Denied"}
            </span>
            <p className="text-sm mt-1.5 leading-relaxed">{claim.reasoning}</p>
          </div>

          {claim.status === "paying" && <p className="text-sm text-muted">Payout submitted, confirming on-chain…</p>}

          {claim.status === "paid" && claim.payoutTxHash && (
            <div className="rounded-md bg-surface-2 border border-primary px-4 py-3.5">
              <span className="label-caps text-primary">Paid</span>
              <a
                href={`${EXPLORER_TX_BASE}${claim.payoutTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="block mt-1.5 text-sm font-mono text-primary hover:underline break-all"
              >
                {claim.payoutTxHash} ↗
              </a>
            </div>
          )}

          {claim.status === "failed" && (
            <div className="rounded-md bg-surface-2 border border-no-bg px-4 py-3.5">
              <span className="label-caps text-no-bg">Payout failed</span>
              <p className="text-sm mt-1.5 leading-relaxed">{claim.failureReason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
