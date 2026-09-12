"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ClaimPanel } from "@/components/app/ClaimPanel";
import { getPolicy } from "@/lib/api";
import type { Policy } from "@/lib/types";

const USDC_DECIMALS = 6;
function formatUsdc(raw: string) {
  return (Number(raw) / 10 ** USDC_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** The policy detail page. Below the policy summary, either the real claim-filing panel (paste a
 * tx hash, the adjuster reviews it live) or, once paid, the payout confirmation. */
export default function PolicyDashboardPage({ params }: { params: { id: string } }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await getPolicy(params.id);
      setPolicy(res.policy);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (!policy) {
    return (
      <>
        <Nav />
        <main className="wrap py-14 max-w-xl flex flex-col gap-4">
          {error ? <p className="text-no-bg">{error}</p> : <div className="card h-40 animate-pulse bg-surface-2" />}
        </main>
      </>
    );
  }

  const statusLabel = policy.claimed ? "Claim paid" : policy.active ? "Active" : "Expired";
  const statusClass = policy.claimed || policy.active ? "badge-low" : "badge-declined";

  return (
    <>
      <Nav />
      <main className="wrap py-14 max-w-xl flex flex-col gap-6">
        <Link href="/dashboard" className="text-sm text-muted hover:text-fg transition-colors -mb-2 self-start">
          ← Back to dashboard
        </Link>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-3xl tracking-[-0.02em]">Policy</h1>
            <p className="font-mono text-xs text-muted mt-1 truncate">{policy.id}</p>
          </div>
          <span className={`badge ${statusClass} shrink-0`}>{statusLabel}</span>
        </div>

        <div className="card flex flex-col gap-5">
          <div className="rounded-md bg-surface-2 border border-border px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <span className="label-caps">Coverage cap</span>
              <p className="font-display text-2xl text-primary mt-1">${formatUsdc(policy.coverageCap)}</p>
            </div>
            <div>
              <span className="label-caps">Premium paid</span>
              <p className="font-display text-2xl mt-1">${formatUsdc(policy.premiumPaid)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Row label="Covered addresses" value={policy.coveredAddresses.join(", ")} mono />
            <Row label="Payout address" value={policy.payoutAddress} mono />
            <Row label="Expires" value={new Date(policy.expiry).toLocaleDateString()} />
            <Row label="Bind tx" value={policy.bindTxHash ?? "—"} mono />
          </div>
        </div>

        {policy.claimed && (
          <div className="card card-accent fade-in-up flex items-start gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary font-display text-base">
              ✓
            </span>
            <div className="flex flex-col gap-2 min-w-0">
              <div>
                <span className="label-caps text-primary">Payout complete</span>
                <p className="text-fg mt-1.5 leading-relaxed">
                  ${formatUsdc(policy.coverageCap)} USDC sent to{" "}
                  <span className="font-mono text-sm">{policy.payoutAddress}</span> — one transaction
                  ID, no human review, paid in seconds.
                </p>
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-muted pt-1">
                {policy.claimedAt && <span>Paid {new Date(policy.claimedAt).toLocaleString()}</span>}
                {policy.claimTriggerAddress && (
                  <span>
                    Triggered by transfer to <span className="font-mono">{policy.claimTriggerAddress}</span>
                  </span>
                )}
                {policy.claimTxHash && (
                  <a
                    href={`https://testnet.arcscan.app/tx/${policy.claimTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-primary hover:underline break-all"
                  >
                    {policy.claimTxHash} ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {!policy.claimed && <ClaimPanel policyId={policy.id} onPaid={refresh} />}

        {error && <p className="text-no-bg text-sm">{error}</p>}
      </main>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="label-caps shrink-0">{label}</span>
      <span className={`text-sm text-right break-all ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
