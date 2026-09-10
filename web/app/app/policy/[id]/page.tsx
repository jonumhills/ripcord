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
        <main className="wrap py-12">{error ? <p className="text-no-bg">{error}</p> : "Loading…"}</main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="wrap py-12 max-w-xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-semibold text-2xl">Policy #{policy.id}</h1>
          <span className={`badge ${policy.claimed ? "badge-declined" : "badge-low"}`}>
            {policy.claimed ? "Claim paid" : policy.active ? "Active" : "Expired"}
          </span>
        </div>

        <div className="card flex flex-col gap-3">
          <Row label="Covered addresses" value={policy.coveredAddresses.join(", ")} mono />
          <Row label="Payout address" value={policy.payoutAddress} mono />
          <Row label="Coverage cap" value={`$${formatUsdc(policy.coverageCap)} USDC`} />
          <Row label="Premium paid" value={`$${formatUsdc(policy.premiumPaid)} USDC`} />
          <Row label="Expires" value={new Date(policy.expiry).toLocaleDateString()} />
          <Row label="Bind tx" value={policy.bindTxHash ?? "—"} mono />
        </div>

        {policy.claimed && (
          <div className="card border-primary">
            <span className="label-caps text-primary">Payout complete</span>
            <p className="text-fg mt-2">
              ${formatUsdc(policy.coverageCap)} USDC sent to {policy.payoutAddress} — no claim form, no review.
            </p>
          </div>
        )}

        {!policy.claimed && (
          <div className="card flex flex-col gap-3">
            <span className="label-caps">Simulate incident (demo)</span>
            <p className="text-xs text-muted">
              Fires the same claims-agent path the live monitor uses. Use a pre-seeded flagged
              address here for the video — see backend README for how the registry is seeded.
            </p>
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
            <button className="btn btn-primary self-start" disabled={!triggerAddress || firing} onClick={handleSimulate}>
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
      <span className={`text-sm text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
