import { config } from "../config.js";
import type { Address } from "../types.js";

/**
 * The Graph Token API — used for two signals: wallet age (approximated, see below) and
 * activity/counterparty history. This is Graph Product #1 in the pipeline.
 *
 * Corrected 2026-09-11 after testing against a real API key instead of guessing further:
 *   - Auth is `X-Api-Key: <key>`, NOT `Authorization: Bearer <key>` (confirmed: Bearer gets a
 *     real 401, X-Api-Key gets real filtered data — tested both directly against the API).
 *   - There is no single `address` filter param — it's silently ignored (schema allows unknown
 *     query keys through rather than rejecting them, which is what made the wrong param name
 *     hard to notice: requests "succeeded" with unfiltered data instead of erroring). The real
 *     params are `from_address` and `to_address`, confirmed by triggering the API's own Zod
 *     validation errors on a bad address value for each candidate name.
 *   - This API key's plan caps `limit` at **10** (a 403 above that, distinct from the schema's
 *     general max of 1000) — confirmed live. That's a real constraint on this free tier, not a
 *     guess: with only the 10 most recent transfers visible per direction, "wallet age" can't
 *     mean true first-ever-transfer for any wallet with more than 10 lifetime transfers of the
 *     tracked types. getWalletAgeDays() below is honestly a lower bound, not an exact answer —
 *     documented in its own comment. A paid plan tier would very likely raise this cap.
 */

const MAX_LIMIT = 10;

interface TokenApiTransfer {
  timestamp: number; // epoch seconds — confirmed field name/shape from a live response
  transaction_id: string;
  from: string;
  to: string;
}

interface TokenApiTransfersResponse {
  data: TokenApiTransfer[];
}

async function tokenApiFetch(params: Record<string, string>): Promise<TokenApiTransfersResponse> {
  const url = new URL("/v1/evm/transfers", config.graph.tokenApiBaseUrl);
  url.searchParams.set("network", config.graph.tokenApiNetwork);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { "X-Api-Key": config.graph.tokenApiKey, Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Graph Token API /v1/evm/transfers failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenApiTransfersResponse;
}

/** Fetch the most recent transfers in each direction and merge — this plan's 10-item cap means
 * "most recent N" is genuinely all we can see per call, so every signal below is built from that. */
async function recentTransfersBothDirections(address: Address): Promise<TokenApiTransfer[]> {
  const [outgoing, incoming] = await Promise.all([
    tokenApiFetch({ from_address: address, limit: String(MAX_LIMIT) }),
    tokenApiFetch({ to_address: address, limit: String(MAX_LIMIT) }),
  ]);
  return [...(outgoing.data ?? []), ...(incoming.data ?? [])];
}

/**
 * Approximate wallet age: the OLDEST timestamp among the most recent 10 outgoing + 10 incoming
 * transfers. This is a lower bound, not the true first-ever transfer, whenever a wallet has more
 * than 10 lifetime transfers in either direction — which is common for any wallet older than a
 * few weeks. Good enough to distinguish "brand new wallet" (all 20 slots empty or very recent)
 * from "has some history," which is what the risk score actually needs; not good enough to prove
 * a wallet is exactly N days old. Flagged clearly rather than presented as exact.
 */
export async function getWalletAgeDays(address: Address): Promise<number | null> {
  const transfers = await recentTransfersBothDirections(address);
  if (transfers.length === 0) return null;

  const oldest = Math.min(...transfers.map((t) => t.timestamp));
  return Math.floor((Date.now() - oldest * 1000) / (1000 * 60 * 60 * 24));
}

/** All counterparties visible in the last 10 transfers each direction — cross-referenced against
 * the flagged list in riskEngine. Same 10-per-direction cap as everything else here. */
export async function getTransferCounterparties(address: Address): Promise<Address[]> {
  const transfers = await recentTransfersBothDirections(address);

  const counterparties = new Set<Address>();
  for (const t of transfers) {
    const other = t.from.toLowerCase() === address.toLowerCase() ? t.to : t.from;
    if (other) counterparties.add(other.toLowerCase() as Address);
  }
  return [...counterparties];
}

/** Recent activity count (capped at 20 — 10 per direction), not a true lifetime total. Renamed
 * in spirit from an earlier "total transfer count" that this plan's limit can't actually support. */
export async function getRecentActivityCount(address: Address): Promise<number> {
  const transfers = await recentTransfersBothDirections(address);
  return transfers.length;
}

/** Transfers strictly newer than `sinceMs`, from this address outward — what the monitor polls on
 * an interval to catch a drain. Only needs from_address; 10-item cap is plenty for a 5s poll tick. */
export async function getOutgoingTransfersSince(
  address: Address,
  sinceMs: number
): Promise<{ to: Address; txHash: string; timestampMs: number }[]> {
  const res = await tokenApiFetch({ from_address: address, limit: String(MAX_LIMIT) });

  return (res.data ?? [])
    .map((t) => ({ to: t.to.toLowerCase() as Address, txHash: t.transaction_id, timestampMs: t.timestamp * 1000 }))
    .filter((t) => t.timestampMs > sinceMs);
}
