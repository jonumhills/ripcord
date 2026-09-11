import { randomBytes } from "node:crypto";
import { getPool } from "../db/pool.js";
import type { Address } from "../types.js";

/**
 * Sign-in with wallet — a real signature challenge, not just "trust whatever address the
 * frontend sends." An address alone is spoofable (anyone can claim any address in a request
 * body); this proves the caller actually holds the private key by having them sign a one-time
 * nonce, verified with viem's recoverMessageAddress in routes/auth.ts.
 *
 * Backed by Postgres (via Supabase) — was pure in-memory, which reset on every restart and would
 * have broken entirely the moment more than one backend instance is running (a session created
 * on instance A wouldn't be visible to instance B). Same tables as policyStore.ts, same pool.
 * Run backend/supabase/schema.sql once on the project before using this.
 */

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes to complete the signature in the wallet
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
export async function issueNonce(address: Address): Promise<{ message: string }> {
  const nonce = randomBytes(16).toString("hex");
  const message = buildSignInMessage(address, nonce);
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

  await getPool().query(
    `insert into auth_nonces (address, message, expires_at) values ($1, $2, $3)
     on conflict (address) do update set message = excluded.message, expires_at = excluded.expires_at`,
    [address.toLowerCase(), message, expiresAt]
  );

  return { message };
}

/** Returns and deletes (one-time use) the exact message issued for this address, or null if
 * there's no pending request or it expired. */
export async function consumeNonceMessage(address: Address): Promise<string | null> {
  const key = address.toLowerCase();
  const { rows } = await getPool().query<{ message: string; expires_at: Date }>(
    "delete from auth_nonces where address = $1 returning message, expires_at",
    [key]
  );
  const entry = rows[0];
  if (!entry || entry.expires_at.getTime() < Date.now()) return null;
  return entry.message;
}

export async function createSession(address: Address): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getPool().query("insert into auth_sessions (token, address, expires_at) values ($1, $2, $3)", [
    token,
    address.toLowerCase(),
    expiresAt,
  ]);
  return token;
}

export async function getSessionAddress(token: string): Promise<Address | null> {
  const { rows } = await getPool().query<{ address: Address; expires_at: Date }>(
    "select address, expires_at from auth_sessions where token = $1",
    [token]
  );
  const entry = rows[0];
  if (!entry || entry.expires_at.getTime() < Date.now()) return null;
  return entry.address;
}

export async function destroySession(token: string): Promise<void> {
  await getPool().query("delete from auth_sessions where token = $1", [token]);
}
