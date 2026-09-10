import type { FastifyInstance } from "fastify";
import { createPolicy, getPolicy } from "../store/memoryStore.js";
import type { Address, Policy } from "../types.js";

interface RegisterBindBody {
  holder: string;
  payoutAddress: string;
  coveredAddresses: string[];
  coverageCap: string;
  premiumPaid: string;
  expiry: string; // ISO
  onChainPolicyId: string; // parsed from the PolicyBound event by the caller
  bindTxHash: string;
}

export function registerPolicyRoutes(app: FastifyInstance) {
  /**
   * POST /api/policy/bind — NOT where the premium payment happens. Binding itself is a direct
   * on-chain call the user's own wallet makes to PolicyVault.bindPolicy() (extension/web call it
   * straight through the injected provider — self-custody, the backend never touches the premium).
   * This endpoint just registers the resulting policy here so the monitor knows to watch it.
   */
  app.post<{ Body: RegisterBindBody }>("/api/policy/bind", async (req, reply) => {
    const b = req.body ?? ({} as RegisterBindBody);
    if (!b.holder || !b.payoutAddress || !b.coveredAddresses?.length || !b.onChainPolicyId || !b.bindTxHash) {
      return reply.status(400).send({ error: "missing required fields" });
    }

    const policy: Omit<Policy, "id"> = {
      holder: b.holder as Address,
      payoutAddress: b.payoutAddress as Address,
      coveredAddresses: b.coveredAddresses as Address[],
      coverageCap: b.coverageCap,
      premiumPaid: b.premiumPaid,
      startTime: new Date().toISOString(),
      expiry: b.expiry,
      active: true,
      claimed: false,
      onChainPolicyId: b.onChainPolicyId,
      bindTxHash: b.bindTxHash,
    };

    const saved = createPolicy(policy);
    return reply.status(201).send({ policy: saved });
  });

  app.get<{ Params: { id: string } }>("/api/policy/:id", async (req, reply) => {
    const policy = getPolicy(req.params.id);
    if (!policy) return reply.status(404).send({ error: "not found" });
    return { policy };
  });
}
