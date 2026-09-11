import { config } from "../config.js";
import type { Address } from "../types.js";

/**
 * Sourcify — free, no API key, decentralized contract verification lookup.
 * Used to check whether spenders returned by GoldRush/the subgraph are verified contracts.
 * An unlimited approval to an unverified contract is a much stronger risk signal than an
 * unlimited approval to, say, Uniswap's router.
 *
 * Corrected 2026-09-11 after hitting this live: the old `/server/check-all-by-addresses` (v1)
 * endpoint this used to call is dead — Sourcify's own docs say "API v1 has been completely
 * turned off as of July 7, 2026." Confirmed the real v2 shape directly:
 *   GET /v2/contract/{chainId}/{address}  → 200 with match info if verified, 404 if not.
 * Also worth knowing: firing one request per approval spender doesn't scale — a heavily-used
 * wallet (tested against a real one) can have 900+ historical spenders, which floods Sourcify
 * and gets rate-limited (429, confirmed live) well before it finishes. riskEngine.ts now dedupes
 * and only checks spenders with an *unlimited* allowance — that's the actual risk signal, and
 * it's a much smaller set.
 */

export async function isContractVerified(address: Address, chainId: number): Promise<boolean> {
  const url = `${config.sourcify.baseUrl}/v2/contract/${chainId}/${address}`;

  const res = await fetch(url);
  if (res.status === 404) return false; // confirmed shape: {"match":null,...} with 404
  if (!res.ok) {
    console.warn(`[sourcify] unexpected status ${res.status} for ${address} — treating as unverified`);
    return false;
  }

  const body = (await res.json()) as { match?: string | null };
  return Boolean(body.match);
}

/** Checks each address in sequence with a small delay rather than firing them all in parallel —
 * Sourcify's public instance rate-limits aggressively (confirmed: 429 after a burst of ~50
 * concurrent requests). Callers should already have deduped/filtered to a small set
 * (riskEngine.ts only passes unique unlimited-approval spenders, not every spender ever seen). */
export async function filterUnverified(addresses: Address[], chainId: number): Promise<Address[]> {
  const unverified: Address[] = [];
  for (const addr of addresses) {
    const verified = await isContractVerified(addr, chainId);
    if (!verified) unverified.push(addr);
  }
  return unverified;
}
