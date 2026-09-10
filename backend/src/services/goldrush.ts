import { config } from "../config.js";
import type { Address, ApprovalSignal } from "../types.js";

/**
 * GoldRush (Covalent) — token approvals endpoint.
 * https://goldrush.dev/docs/api-reference/foundational-api/security/get-token-approvals-for-address
 * Purpose-built for exactly this signal: every spender + allowance for a wallet, already
 * flagging unlimited allowances. Not on The Graph — Token API has no approvals endpoint (yet),
 * so this stays a separate, unrelated integration rather than being forced onto Graph.
 */

interface GoldRushApprovalItem {
  spender_address: string;
  token_address: string;
  allowance: string; // decimal string; "UNLIMITED" style sentinel or huge uint depending on API version
  quote?: number | null;
  updated_at?: string | null;
}

interface GoldRushApprovalsResponse {
  data: {
    items: GoldRushApprovalItem[];
  };
}

// ERC20 max uint256 — how "unlimited" approvals typically show up on-chain.
const UNLIMITED_THRESHOLD = 10n ** 30n;

export async function getApprovals(address: Address): Promise<ApprovalSignal[]> {
  const url = `https://api.covalenthq.com/v1/${config.goldrush.chainName}/approvals/${address}/`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.goldrush.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`GoldRush approvals failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as GoldRushApprovalsResponse;

  return (body.data?.items ?? []).map((item) => {
    let isUnlimited = false;
    try {
      isUnlimited = BigInt(item.allowance) >= UNLIMITED_THRESHOLD;
    } catch {
      // Some API responses return a human-readable "Unlimited" string instead of a raw uint.
      isUnlimited = /unlimited/i.test(item.allowance);
    }

    const lastUpdatedDaysAgo = item.updated_at
      ? Math.floor((Date.now() - new Date(item.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      spender: item.spender_address.toLowerCase() as Address,
      token: item.token_address.toLowerCase() as Address,
      isUnlimited,
      lastUpdatedDaysAgo,
    };
  });
}
