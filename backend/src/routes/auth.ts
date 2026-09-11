import type { FastifyInstance } from "fastify";
import { recoverMessageAddress } from "viem";
import { issueNonce, consumeNonceMessage, createSession, destroySession } from "../services/authStore.js";
import type { Address } from "../types.js";

/**
 * Sign-in with wallet, real signature verification — not just "the frontend says this is my
 * address." Flow: POST /nonce gets a one-time message to sign, the wallet signs it with
 * personal_sign (no gas, no transaction — just proves key ownership), POST /verify recovers the
 * signing address from that signature with viem's recoverMessageAddress (pure/offline, no RPC
 * call needed — works for EOA wallets; a smart-contract wallet would need ERC-1271 instead,
 * out of scope here) and issues a session token if it matches the claimed address.
 */
export function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: { address: string } }>("/api/auth/nonce", async (req, reply) => {
    const { address } = req.body ?? {};
    if (!address) return reply.status(400).send({ error: "address is required" });

    const { message } = await issueNonce(address as Address);
    return { message };
  });

  app.post<{ Body: { address: string; signature: string } }>("/api/auth/verify", async (req, reply) => {
    const { address, signature } = req.body ?? {};
    if (!address || !signature) {
      return reply.status(400).send({ error: "address and signature are required" });
    }

    const message = await consumeNonceMessage(address as Address);
    if (!message) {
      return reply
        .status(400)
        .send({ error: "no pending sign-in request for this address (or it expired) — request a new nonce" });
    }

    let recovered: Address;
    try {
      recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
    } catch (err) {
      return reply.status(400).send({ error: "malformed signature" });
    }

    if (recovered.toLowerCase() !== (address as string).toLowerCase()) {
      return reply.status(401).send({ error: "signature does not match the claimed address" });
    }

    const token = await createSession(address as Address);
    return { token, address: (address as string).toLowerCase() };
  });

  app.post("/api/auth/signout", async (req, reply) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) await destroySession(auth.slice("Bearer ".length));
    return { status: "ok" };
  });
}
