import { listActivePolicies } from "../store/policyStore.js";
import { getOutgoingTransfersSince } from "../services/graphTokenApi.js";
import { isFlaggedAddress } from "../services/scamsniffer.js";
import { handleIncident } from "../agents/claimsAgent.js";
import type { Address, Incident } from "../types.js";

/**
 * Polls the Token API (Graph Product #1) for each actively-insured address, looking for a new
 * outgoing transfer to a flagged destination. Renamed from the earlier subgraphWatcher.ts —
 * that version queried a custom Subgraph for arbitrary insured wallets, which doesn't work: a
 * Subgraph's data sources are bound to fixed contract addresses declared at deploy time, and
 * insured EOAs aren't contracts you control or predeploy against. The Token API's per-address
 * Transfers endpoint is the correct tool for "arbitrary address, no fixed contract" — see
 * subgraph/README.md for the full explanation and where the subgraph package went instead.
 */

const POLL_INTERVAL_MS = 5000;
const lastCheckedMs = new Map<string, number>(); // per-address watermark, avoids re-processing old transfers

async function tick() {
  const policies = await listActivePolicies();
  if (policies.length === 0) return;

  const allCoveredAddresses = new Set<Address>();
  for (const p of policies) for (const a of p.coveredAddresses) allCoveredAddresses.add(a);

  for (const address of allCoveredAddresses) {
    const since = lastCheckedMs.get(address) ?? Date.now() - 60_000; // first check: look back 1 minute
    lastCheckedMs.set(address, Date.now());

    let outgoing;
    try {
      outgoing = await getOutgoingTransfersSince(address, since);
    } catch (err) {
      console.error(`[monitor] Token API poll failed for ${address}:`, err);
      continue;
    }

    for (const t of outgoing) {
      const flagged = await isFlaggedAddress(t.to);
      if (!flagged) continue; // the core insurable trigger: destination is a known-bad address

      const coveringPolicies = policies.filter((p) =>
        p.coveredAddresses.some((a) => a.toLowerCase() === address.toLowerCase())
      );

      for (const policy of coveringPolicies) {
        const incident: Incident = {
          policyId: policy.id,
          triggerAddress: t.to,
          fromAddress: address,
          txHash: t.txHash,
          matchedReason: "Destination address is on the flagged-drainer registry",
          detectedAt: new Date().toISOString(),
        };
        console.log(`[monitor] incident detected for policy ${policy.id}:`, incident);
        await handleIncident(incident);
      }
    }
  }
}

let timer: NodeJS.Timeout | null = null;

export function startMonitor() {
  if (timer) return;
  timer = setInterval(() => {
    tick().catch((err) => console.error("[monitor] tick failed:", err));
  }, POLL_INTERVAL_MS);
  console.log(`[monitor] polling every ${POLL_INTERVAL_MS}ms via Token API`);
}

export function stopMonitor() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Exposed for the demo: fire an incident directly without waiting on real polling latency, so
 * the hackathon video can trigger a payout deterministically on cue. */
export async function simulateIncident(incident: Incident) {
  return handleIncident(incident);
}
