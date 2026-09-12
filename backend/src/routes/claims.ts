import type { FastifyInstance } from "fastify";
import { reviewAndPayClaim } from "../agents/claimsAdjuster.js";
import { getClaim } from "../store/claimStore.js";
import { getPolicy } from "../store/policyStore.js";
import { listClaimsForPolicy } from "../store/claimStore.js";

interface SubmitClaimBody {
  policyId: string;
  txHash: string;
}

export function registerClaimsRoutes(app: FastifyInstance) {
  /**
   * POST /api/claims — the real claims process. Paste a transaction hash you believe is a
   * covered drain; the adjuster independently reads that transaction from Arc, runs its full
   * checklist against it, and — if approved — pays out immediately, all in one call. The
   * response is the finished (or denied) claim record, including the adjuster's reasoning and
   * every check it ran. This is also what the monitor calls internally when it auto-detects a
   * drain — same pipeline either way, see claimsAdjuster.ts.
   */
  app.post<{ Body: SubmitClaimBody }>("/api/claims", async (req, reply) => {
    const { policyId, txHash } = req.body ?? ({} as SubmitClaimBody);
    if (!policyId || !txHash) {
      return reply.status(400).send({ error: "policyId and txHash are required" });
    }

    const policy = await getPolicy(policyId);
    if (!policy) return reply.status(404).send({ error: `no policy with id ${policyId}` });

    try {
      const claim = await reviewAndPayClaim(policyId, txHash);
      return reply.status(201).send({ claim });
    } catch (err) {
      req.log.error(err);
      return reply.status(502).send({ error: "claim review failed", detail: String(err) });
    }
  });

  app.get<{ Params: { id: string } }>("/api/claims/:id", async (req, reply) => {
    const claim = await getClaim(req.params.id);
    if (!claim) return reply.status(404).send({ error: "not found" });
    return { claim };
  });

  app.get<{ Params: { id: string } }>("/api/policy/:id/claims", async (req, reply) => {
    const claims = await listClaimsForPolicy(req.params.id);
    return { claims };
  });
}
