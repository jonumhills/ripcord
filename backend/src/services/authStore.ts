import { randomBytes } from "node:crypto";
import type { Address } from "../types.js";

/**
 * Sign-in with wallet — a real signature challenge, not just "trust whatever address the
 * frontend sends." An address alone is spoofable (anyone can claim any address in a request
 * body); this proves the caller actually holds the private key by having them sign a one-time
 * nonce, verified with viem's recoverMessageAddress in routes/auth.ts.
 *
 * In-memory, same reasoning as memoryStore.ts: no DB for a hackathon, restart-to-reset. Swap for
 * Redis/Postgres before this is a real product — session/nonce lookups are isolated here.
 */

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes to complete the signature in the wallet
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface NonceEntry {
  message: string; // the exact string the user is asked to sign — stored verbatim, never
  // regenerated at verify time, since regenerating with a fresh timestamp would produce a
  // different message than what was actually signed and always fail verification
  expiresAt: number;
}

interface SessionEntry {
  address: Address;
  expiresAt: number;
}

const nonces = new Map<string, NonceEntry>(); // key: address (lowercased)
const sessions = new Map<string, SessionEntry>(); // key: opaque token

function buildSignInMessage(address: Address, nonce: string): string {
  return [
    "Sign in to Ripcord",
    "",
    "This request will not trigger a blockchain transaction or cost any gas.",
    "",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${new Date().toISOString()}`,
  ].join("\n");
}

/** Issues a fresh one-time message for this address to sign. Overwrites any pending nonce for
 * the same address (only the most recent sign-in attempt is valid). */
export function issueNonce(address: Address): { message: string } {
  const nonce = randomBytes(16).toString("hex");
  const message = buildSignInMessage(address, nonce);
  nonces.set(address.toLowerCase(), { message, expiresAt: Date.now() + NONCE_TTL_MS });
  return { message };
}

/** Returns and deletes (one-time use) the exact message issued for this address, or null if
 * there's no pending request or it expired. */
export function consumeNonceMessage(address: Address): string | null {
  const key = address.toLowerCase();
  const entry = nonces.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    nonces.delete(key);
    return null;
  }
  nonces.delete(key);
  return entry.message;
}

export function createSession(address: Address): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { address: address.toLowerCase() as Address, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function getSessionAddress(token: string): Address | null {
  const entry = sessions.get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.address;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}
