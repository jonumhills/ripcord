import type { FastifyRequest, FastifyReply } from "fastify";
import { getSessionAddress } from "../services/authStore.js";
import type { Address } from "../types.js";

/** Reads `Authorization: Bearer <token>`, resolves it to the signed-in address, or writes a 401
 * and returns null. Callers must `await` this and check for null, returning early — same pattern
 * as routes/admin.ts's requireAdmin, kept consistent across both auth styles in this backend. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<Address | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "missing Authorization: Bearer <token> — sign in first" });
    return null;
  }

  const address = await getSessionAddress(auth.slice("Bearer ".length));
  if (!address) {
    reply.status(401).send({ error: "invalid or expired session — sign in again" });
    return null;
  }

  return address;
}
