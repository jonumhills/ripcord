import { config } from "../config.js";
import type { Address } from "../types.js";

/**
 * ScamSniffer scam-database — https://github.com/scamsniffer/scam-database
 * Free, no API key, refreshed daily. Honest caveat: the open-source list has a 7-day delay
 * versus their paid real-time API — fine for a hackathon demo, worth knowing if this becomes
 * the real product and you need faster detection.
 *
 * This is also the source `FlaggedRegistry`-equivalent list for the Arc claims agent and the
 * Subgraph monitor: an address that shows up here is what actually triggers an autonomous payout.
 */

let cache: { addresses: Set<string>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // re-pull hourly; the list itself only moves daily

async function loadList(): Promise<Set<string>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.addresses;

  const res = await fetch(config.scamsniffer.addressListUrl);
  if (!res.ok) {
    throw new Error(`ScamSniffer list fetch failed: ${res.status}`);
  }

  const raw = (await res.json()) as string[] | Record<string, unknown>;
  const list = Array.isArray(raw) ? raw : Object.keys(raw);
  const addresses = new Set(list.map((a) => a.toLowerCase()));

  cache = { addresses, fetchedAt: Date.now() };
  return addresses;
}

export async function isFlaggedAddress(address: Address): Promise<boolean> {
  const list = await loadList();
  return list.has(address.toLowerCase());
}

/** Given a set of counterparty addresses, return which ones are on the flagged list. */
export async function filterFlagged(addresses: Address[]): Promise<Address[]> {
  const list = await loadList();
  return addresses.filter((a) => list.has(a.toLowerCase()));
}
