import { config } from "../config.js";
import type { Address } from "../types.js";

/**
 * The Graph Token API — used for two signals: wallet age (first transfer timestamp) and
 * activity/counterparty history. This is Graph Product #1 in the pipeline.
 *
 * Corrected 2026-09-09 after actually checking the docs instead of guessing: the official
 * quick-start page (thegraph.com/docs/en/token-api/quick-start/) 301-redirects to
 * app.pinax.network/docs/api/ — Pinax operates the Token API for The Graph. Real shape:
 *   GET https://api.pinax.network/v1/evm/transfers?network=mainnet&address=0x...&limit=10
 * Not `/transfers/evm/{address}` with no network param, which is what an earlier pass here
 * guessed and never verified.
 *
 * Also load-bearing for the whole risk-scoring design: confirmed supported networks are
 * Ethereum (mainnet), Base, Arbitrum One, and Solana (SVM) — Arc is NOT in that list. That's
 * fine and expected — the wallets being insured live on the chains where they actually have
 * history (mainnet, Base, etc.), while Arc is purely PolicyVault's settlement chain for
 * premiums and payouts. `GRAPH_TOKEN_API_NETWORK` picks which one to query per assessment;
 * defaults to mainnet since that's where most wallet history actually lives.
 */

interface TokenApiTransfer {
  block_timestamp: string; // ISO (or epoch seconds depending on API version — see note in getWalletAgeDays)
  transaction_hash: string;
  from_address: string;
  to_address: string;
}

interface TokenApiTransfersResponse {
  data: TokenApiTransfer[];
}

async function tokenApiFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path, config.graph.tokenApiBaseUrl);
  url.searchParams.set("network", config.graph.tokenApiNetwork);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.graph.tokenApiKey}`, Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Graph Token API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

function parseTimestamp(raw: string): number {
  // Defensive: token API responses have been observed with both ISO strings and epoch seconds
  // depending on version — handle both rather than assuming one and silently getting NaN.
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && raw.trim() !== "") return asNumber * (raw.length <= 10 ? 1000 : 1);
  return new Date(raw).getTime();
}

/** First-ever transfer timestamp for an address, oldest first — our proxy for wallet age. */
export async function getWalletAgeDays(address: Address): Promise<number | null> {
  const res = await tokenApiFetch<TokenApiTransfersResponse>("/v1/evm/transfers", {
    address,
    limit: "1",
  });

  const first = res.data?.[0];
  if (!first) return null;

  const firstSeen = parseTimestamp(first.block_timestamp);
  return Math.floor((Date.now() - firstSeen) / (1000 * 60 * 60 * 24));
}

/** All transfer counterparties for an address — cross-referenced against the flagged list in riskEngine. */
export async function getTransferCounterparties(address: Address, limit = 500): Promise<Address[]> {
  const res = await tokenApiFetch<TokenApiTransfersResponse>("/v1/evm/transfers", {
    address,
    limit: String(limit),
  });

  const counterparties = new Set<Address>();
  for (const t of res.data ?? []) {
    const other = t.from_address.toLowerCase() === address.toLowerCase() ? t.to_address : t.from_address;
    counterparties.add(other.toLowerCase() as Address);
  }
  return [...counterparties];
}

export async function getTotalTransferCount(address: Address): Promise<number> {
  const res = await tokenApiFetch<TokenApiTransfersResponse>("/v1/evm/transfers", {
    address,
    limit: "1000",
  });
  return res.data?.length ?? 0;
}

/** Transfers strictly newer than `sinceMs`, from this address outward — what the monitor polls on
 * an interval to catch a drain. Separate from getTransferCounterparties, which is direction-agnostic
 * and used for risk scoring, not live monitoring. */
export async function getOutgoingTransfersSince(
  address: Address,
  sinceMs: number
): Promise<{ to: Address; txHash: string; timestampMs: number }[]> {
  const res = await tokenApiFetch<TokenApiTransfersResponse>("/v1/evm/transfers", {
    address,
    limit: "50",
  });

  return (res.data ?? [])
    .filter((t) => t.from_address.toLowerCase() === address.toLowerCase())
    .map((t) => ({ to: t.to_address.toLowerCase() as Address, txHash: t.transaction_hash, timestampMs: parseTimestamp(t.block_timestamp) }))
    .filter((t) => t.timestampMs > sinceMs);
}
