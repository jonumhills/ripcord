import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";
import { listAllPolicies, getPolicy, updatePolicy, deletePolicy } from "../store/memoryStore.js";
import type { Policy } from "../types.js";

/**
 * Testing-only admin surface: delete or directly edit a policy's coverage without redoing a real
 * on-chain bind each time. NOT a customer-facing feature — a real insurer never lets a
 * policyholder edit their own coverage after the fact, and this exists purely so you (or a
 * teammate) can reset state between test passes instead of spending testnet USDC on every run.
 *
 * Auth: a single shared secret (`ADMIN_API_KEY`), checked via `X-Admin-Key` header. That's
 * intentionally minimal — this is a local/demo tool, not a real admin system with per-user
 * accounts and audit logs. Every route 401s if ADMIN_API_KEY isn't set at all, rather than
 * falling open, so an unconfigured deployment doesn't silently expose these.
 *
 * The important limitation to know before using this: editing `coverageCap` here ONLY changes
 * the backend's own bookkeeping/display. The actual USDC amount `payClaim()` pays out is fixed
 * on-chain in PolicyVault at bind time and is NOT editable — there's no admin function on the
 * contract for that (by design: nothing should be able to change a bound policy's payout after
 * the fact, including the vault's own owner). If you need to test a different payout amount,
 * bind a fresh policy at that amount instead of editing an existing one's coverageCap here.
 */

function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!config.admin.apiKey) {
    reply.status(401).send({ error: "admin routes are disabled — ADMIN_API_KEY is not set" });
    return false;
  }
  if (req.headers["x-admin-key"] !== config.admin.apiKey) {
    reply.status(401).send({ error: "invalid or missing X-Admin-Key header" });
    return false;
  }
  return true;
}

type UpdatablePolicyFields = Partial<
  Pick<Policy, "coverageCap" | "premiumPaid" | "expiry" | "active" | "claimed" | "payoutAddress">
>;

export function registerAdminRoutes(app: FastifyInstance) {
  app.get("/api/admin/policies", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    return { policies: listAllPolicies() };
  });

  app.patch<{ Params: { id: string }; Body: UpdatablePolicyFields }>(
    "/api/admin/policy/:id",
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;

      const existing = getPolicy(req.params.id);
      if (!existing) return reply.status(404).send({ error: "not found" });

      const updated = updatePolicy(req.params.id, req.body ?? {});
      return {
        policy: updated,
        note: "coverageCap changes here are backend-only — the on-chain payout amount is fixed at bind time and cannot be edited. See admin.ts's doc comment.",
      };
    }
  );

  app.delete<{ Params: { id: string } }>("/api/admin/policy/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const existing = getPolicy(req.params.id);
    if (!existing) return reply.status(404).send({ error: "not found" });

    deletePolicy(req.params.id);
    return {
      status: "deleted",
      note: "Removed from backend tracking only — the on-chain policy (if bound) still exists in PolicyVault and its premium is not refunded. This just stops the monitor from watching it and frees the address(es) for a fresh test bind.",
    };
  });
}
