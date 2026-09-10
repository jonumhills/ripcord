import { config } from "../config.js";
import type { Address, ApprovalSignal } from "../types.js";

/**
 * Queries the deployed subgraph/ package — Graph Product #2. See subgraph/README.md for what
 * it indexes and why (a curated set of major mainnet ERC-20 contracts, not arbitrary wallets).
 * Returns [] rather than throwing when GRAPH_SUBGRAPH_URL isn't set yet, so riskEngine.ts can
 * fall back to GoldRush alone without every assessment failing while this is mid-deploy.
 */

interface SubgraphApprovalEvent {
  spender: string;
  token: string;
  tokenSymbol: string;
  amount: string;
  isUnlimited: boolean;
  blockTimestamp: string;
}

const QUERY = `
  query ApprovalsFor($owner: Bytes!) {
    approvalEvents(where: { owner: $owner }, orderBy: blockTimestamp, orderDirection: desc, first: 50) {
      spender
      token
      tokenSymbol
      amount
      isUnlimited
      blockTimestamp
    }
  }
`;

export async function getApprovalsFromSubgraph(owner: Address): Promise<ApprovalSignal[]> {
  if (!config.graph.subgraphUrl) return [];

  const res = await fetch(config.graph.subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { owner: owner.toLowerCase() } }),
  });

  if (!res.ok) {
    console.warn(`[graphSubgraph] query failed: ${res.status}`);
    return [];
  }

  const body = (await res.json()) as { data?: { approvalEvents: SubgraphApprovalEvent[] } };

  return (body.data?.approvalEvents ?? []).map((e) => ({
    spender: e.spender.toLowerCase() as Address,
    token: e.token.toLowerCase() as Address,
    isUnlimited: e.isUnlimited,
    lastUpdatedDaysAgo: Math.floor((Date.now() - Number(e.blockTimestamp) * 1000) / (1000 * 60 * 60 * 24)),
  }));
}
