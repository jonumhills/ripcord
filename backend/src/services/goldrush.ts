import { config } from "../config.js";
import type { Address, ApprovalSignal } from "../types.js";

/**
 * GoldRush (Covalent) — token approvals endpoint.
 * https://goldrush.dev/docs/api-reference/foundational-api/security/get-token-approvals-for-address
 * Purpose-built for exactly this signal: every spender + allowance for a wallet, already
 * flagging unlimited allowances. Not on The Graph — Token API has no approvals endpoint (yet),
 * so this stays a separate, unrelated integration rather than being forced onto Graph.
 *
 * Corrected 2026-09-11 after testing against a real API key: the response is nested by TOKEN,
 * not a flat list of approvals — `data.items[]` is one entry per token the wallet has ever
 * approved, each carrying its own `spenders[]` array. An earlier version here assumed a flat
 * `data.items[]` of individual approvals with a top-level `spender_address`, which doesn't
 * match reality and threw immediately on the first real request. Also: `allowance` can be the
 * literal string `"UNLIMITED"` (confirmed live), not just a very large uint string — checked
 * for explicitly rather than relying on the numeric threshold alone. Freshness comes from each
 * spender's own `block_signed_at` (when that approval tx landed), not a per-token `updated_at`.
 */

interface GoldRushSpender {
  spender_address: string;
  allowance: string; // "UNLIMITED" (confirmed literal) or a decimal string
  block_signed_at: string; // ISO — when this specific approval transaction landed
}

interface GoldRushTokenItem {
  token_address: string;
  spenders: GoldRushSpender[];
}

interface GoldRushApprovalsResponse {
  data: {
    items: GoldRushTokenItem[];
  };
}

// Fallback for the (less common) case allowance comes back as a huge numeric string rather than
// the literal "UNLIMITED" — ERC20 max uint256 territory.
const UNLIMITED_NUMERIC_THRESHOLD = 10n ** 30n;

function isUnlimitedAllowance(allowance: string): boolean {
  if (/unlimited/i.test(allowance)) return true;
  try {
    return BigInt(allowance) >= UNLIMITED_NUMERIC_THRESHOLD;
  } catch {
    return false;
  }
}

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
  const signals: ApprovalSignal[] = [];

  for (const token of body.data?.items ?? []) {
    for (const spender of token.spenders ?? []) {
      const lastUpdatedDaysAgo = spender.block_signed_at
        ? Math.floor((Date.now() - new Date(spender.block_signed_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      signals.push({
        spender: spender.spender_address.toLowerCase() as Address,
        token: token.token_address.toLowerCase() as Address,
        isUnlimited: isUnlimitedAllowance(spender.allowance),
        lastUpdatedDaysAgo,
      });
    }
  }

  return signals;
}
