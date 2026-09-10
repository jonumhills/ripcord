import type { FastifyInstance } from "fastify";
import { simulateIncident } from "../monitor/walletMonitor.js";
import type { Address, Incident } from "../types.js";

interface SimulateBody {
  policyId: string;
  triggerAddress: string; // the pre-seeded flagged address you drain the test wallet to
  fromAddress: string; // the insured test wallet
  txHash: string; // the real testnet tx hash from MockDrainer, so the payout screen shows something real
}

/**
 * Demo-only route: fires the exact same claims-agent path the real monitor would, but on cue —
 * so the hackathon video can trigger a payout deterministically instead of waiting on subgraph
 * indexing latency during a live recording. This is not a shortcut around the real flow, it's
 * calling the same `handleIncident` the monitor calls; only the "how did we learn about the
 * incident" step is manual here instead of polled.
 */
export function registerDemoRoutes(app: FastifyInstance) {
  app.post<{ Body: SimulateBody }>("/api/demo/simulate-incident", async (req, reply) => {
    const { policyId, triggerAddress, fromAddress, txHash } = req.body ?? {};
    if (!policyId || !triggerAddress || !fromAddress || !txHash) {
      return reply.status(400).send({ error: "policyId, triggerAddress, fromAddress, txHash all required" });
    }

    const incident: Incident = {
      policyId,
      triggerAddress: triggerAddress as Address,
      fromAddress: fromAddress as Address,
      txHash,
      matchedReason: "Destination address is on the flagged-drainer registry (simulated for demo)",
      detectedAt: new Date().toISOString(),
    };

    try {
      await simulateIncident(incident);
      return { status: "payout triggered", incident };
    } catch (err) {
      req.log.error(err);
      return reply.status(502).send({ error: "claims agent failed to pay out", detail: String(err) });
    }
  });
}
