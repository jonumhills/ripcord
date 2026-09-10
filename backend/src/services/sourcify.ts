import { config } from "../config.js";
import type { Address } from "../types.js";

/**
 * Sourcify — free, no API key, decentralized contract verification lookup.
 * https://sourcify.dev/
 * Used to check whether spenders returned by GoldRush's approvals list are verified contracts.
 * An unlimited approval to an unverified contract is a much stronger risk signal than an
 * unlimited approval to, say, Uniswap's router.
 */

export async function isContractVerified(address: Address, chainId: number): Promise<boolean> {
  const url = `${config.sourcify.baseUrl}/check-all-by-addresses?addresses=${address}&chainIds=${chainId}`;

  const res = await fetch(url);
  if (!res.ok) {
    // Sourcify returning a non-200 for an unknown address is common — treat as "not verified"
    // rather than throwing, since this signal shouldn't take down a whole risk assessment.
    return false;
  }

  const body = (await res.json()) as Array<{ address: string; chainIds?: unknown[] }>;
  const match = body.find((entry) => entry.address?.toLowerCase() === address.toLowerCase());
  return Boolean(match?.chainIds?.length);
}

export async function filterUnverified(addresses: Address[], chainId: number): Promise<Address[]> {
  const results = await Promise.all(
    addresses.map(async (addr) => ({ addr, verified: await isContractVerified(addr, chainId) }))
  );
  return results.filter((r) => !r.verified).map((r) => r.addr);
}
