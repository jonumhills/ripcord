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
 *     tracked types. getWalletActivitySummary() below is honestly a lower bound, not an exact answer —
 *     documented in its own comment. A paid plan tier would very likely raise this cap.
 *   - The plan also caps overall throughput at 200 requests/minute — hit live once the frontend's
 *     coverage slider started firing a fresh quote (and therefore a fresh full assessment) on
 *     every drag tick, on top of risk-assess and quote each independently re-fetching the same
 *     data three times over (see the cache below and riskEngine.ts's own assessment cache).
 */

const MAX_LIMIT = 10;
const CACHE_TTL_MS = 30_000; // matches riskEngine.ts's assessment cache — same reasoning

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

const recentTransfersCache = new Map<string, { data: TokenApiTransfer[]; expiresAt: number }>();

/** Fetch the most recent transfers in each direction and merge, cached for CACHE_TTL_MS per
 * address. This is called once per assessAddress() now (previously three separate exported
 * functions each called it independently, tripling Token API calls for identical data — that,
 * combined with the frontend re-quoting on every slider tick, is what hit the 200 req/min cap). */
async function recentTransfersBothDirections(address: Address): Promise<TokenApiTransfer[]> {
  const key = address.toLowerCase();
  const cached = recentTransfersCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const [outgoing, incoming] = await Promise.all([
    tokenApiFetch({ from_address: address, limit: String(MAX_LIMIT) }),
    tokenApiFetch({ to_address: address, limit: String(MAX_LIMIT) }),
  ]);
  const data = [...(outgoing.data ?? []), ...(incoming.data ?? [])];
  recentTransfersCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export interface WalletActivitySummary {
  walletAgeDays: number | null;
  totalTransfers: number;
  counterparties: Address[];
}

/**
 * One call, one pair of Token API requests (from + to, cached), deriving all three signals
 * riskEngine.ts needs — wallet age, activity count, counterparties — instead of the three
 * independent functions this used to expose, each re-fetching the same underlying data.
 *
 * Wallet age is the OLDEST timestamp among the most recent 10 outgoing + 10 incoming transfers —
 * a lower bound, not the true first-ever transfer, whenever a wallet has more than 10 lifetime
 * transfers in either direction (common for anything older than a few weeks). Good enough to
 * distinguish "brand new" from "has history," not good enough to prove an exact age.
 */
export async function getWalletActivitySummary(address: Address): Promise<WalletActivitySummary> {
  const transfers = await recentTransfersBothDirections(address);

  const walletAgeDays =
    transfers.length === 0
      ? null
      : Math.floor((Date.now() - Math.min(...transfers.map((t) => t.timestamp)) * 1000) / (1000 * 60 * 60 * 24));

  const counterparties = new Set<Address>();
  for (const t of transfers) {
    const other = t.from.toLowerCase() === address.toLowerCase() ? t.to : t.from;
    if (other) counterparties.add(other.toLowerCase() as Address);
  }

  return { walletAgeDays, totalTransfers: transfers.length, counterparties: [...counterparties] };
}

/** Transfers strictly newer than `sinceMs`, from this address outward — what the monitor polls on
 * an interval to catch a drain. Deliberately NOT cached (the monitor needs the latest data every
 * tick) and only needs from_address; 10-item cap is plenty for a 5s poll tick. */
export async function getOutgoingTransfersSince(
  address: Address,
  sinceMs: number
): Promise<{ to: Address; txHash: string; timestampMs: number }[]> {
  const res = await tokenApiFetch({ from_address: address, limit: String(MAX_LIMIT) });

  return (res.data ?? [])
    .map((t) => ({ to: t.to.toLowerCase() as Address, txHash: t.transaction_id, timestampMs: t.timestamp * 1000 }))
    .filter((t) => t.timestampMs > sinceMs);
}
