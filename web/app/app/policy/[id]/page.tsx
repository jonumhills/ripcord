"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { getPolicy, simulateIncident } from "@/lib/api";
import type { Policy } from "@/lib/types";

const USDC_DECIMALS = 6;
function formatUsdc(raw: string) {
  return (Number(raw) / 10 ** USDC_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * The policy dashboard — and the page to have open when recording the hackathon demo video.
 * The "Simulate incident" panel is demo-only: it calls the exact same claims-agent code path
 * the live monitor calls (see backend/src/routes/demo.ts), just triggered on cue instead of
 * waiting on real subgraph indexing latency while the camera is rolling.
 */
export default function PolicyDashboardPage({ params }: { params: { id: string } }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggerAddress, setTriggerAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [firing, setFiring] = useState(false);

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
  }, [params.id]);

  // While a claim is in flight, poll until the policy flips to claimed — that's the moment
  // to cut to on camera.
  useEffect(() => {
    if (!firing) return;
    const interval = setInterval(refresh, 1500);
    return () => clearInterval(interval);
  }, [firing]);

  useEffect(() => {
    if (policy?.claimed) setFiring(false);
  }, [policy?.claimed]);

  async function handleSimulate() {
    if (!policy) return;
    setFiring(true);
    setError(null);
    try {
      await simulateIncident({
        policyId: policy.id,
        triggerAddress,
        fromAddress: policy.coveredAddresses[0],
        txHash: txHash || `0xdemo${Date.now().toString(16)}`,
      });
    } catch (err) {
      setFiring(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

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
        <div className="flex items-center justify-between">
          <h1 className="font-display font-semibold text-3xl tracking-[-0.02em]">Policy #{policy.id}</h1>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
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
            <div>
              <span className="label-caps text-primary">Payout complete</span>
              <p className="text-fg mt-1.5 leading-relaxed">
                ${formatUsdc(policy.coverageCap)} USDC sent to{" "}
                <span className="font-mono text-sm">{policy.payoutAddress}</span> — no claim form,
                no review, no wait.
              </p>
            </div>
          </div>
        )}

        {!policy.claimed && (
          <div className="card flex flex-col gap-4">
            <div>
              <span className="label-caps">Simulate incident (demo)</span>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">
                Fires the same claims-agent path the live monitor uses. Use a pre-seeded flagged
                address here for the video — see backend README for how the registry is seeded.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <input
                className="input"
                placeholder="Flagged destination address (0x…)"
                value={triggerAddress}
                onChange={(e) => setTriggerAddress(e.target.value)}
              />
              <input
                className="input"
                placeholder="Drain tx hash (optional — leave blank for a demo hash)"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
              />
            </div>
            <button className="btn btn-primary self-start" disabled={!triggerAddress || firing} onClick={handleSimulate}>
              {firing && <span className="inline-block h-2 w-2 rounded-full bg-on-primary animate-pulse" />}
              {firing ? "Watching for payout…" : "Trigger drain event →"}
            </button>
          </div>
        )}

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
