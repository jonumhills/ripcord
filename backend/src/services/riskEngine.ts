import * as graphTokenApi from "./graphTokenApi.js";
import * as goldrush from "./goldrush.js";
import * as graphSubgraph from "./graphSubgraph.js";
import * as scamsniffer from "./scamsniffer.js";
import * as sourcify from "./sourcify.js";
import { config } from "../config.js";
import type { Address, AddressRiskScore, AddressSignals, ApprovalSignal } from "../types.js";

// Cached per address for ASSESSMENT_CACHE_TTL_MS: the UI calls /api/risk/assess and then
// immediately /api/quote for the same addresses, and the quote screen's coverage slider refires
// /api/quote on every drag tick even though none of that changes a wallet's actual risk signals —
// only the coverage cap. Without this, that flow alone was enough to blow through the Token API's
// 200 req/min plan cap (confirmed live) on a single slider drag. Coverage-cap changes only need
// quoteEngine's cheap local math re-run, not a full re-assessment.
const ASSESSMENT_CACHE_TTL_MS = 30_000;
const assessmentCache = new Map<string, { result: AddressRiskScore; expiresAt: number }>();

/**
 * Pulls all live signals for one address and turns them into a score. Load-bearing on two
 * separate Graph products: the Token API (wallet age + counterparties) and the subgraph/
 * package (a live approvals feed for major mainnet tokens) — delete either and this function
 * degrades or breaks, which is the bar the AI-tooling and Composable tracks both ask for.
 */
export async function assessAddress(address: Address): Promise<AddressRiskScore> {
  const key = address.toLowerCase();
  const cached = assessmentCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const result = await assessAddressUncached(address);
  assessmentCache.set(key, { result, expiresAt: Date.now() + ASSESSMENT_CACHE_TTL_MS });
  return result;
}

async function assessAddressUncached(address: Address): Promise<AddressRiskScore> {
  const [activity, goldrushApprovals, subgraphApprovals] = await Promise.all([
    graphTokenApi.getWalletActivitySummary(address),
    goldrush.getApprovals(address),
    graphSubgraph.getApprovalsFromSubgraph(address),
  ]);
  const { walletAgeDays, totalTransfers, counterparties } = activity;

  const approvals = mergeApprovals(goldrushApprovals, subgraphApprovals);

  // Only check verification for unique, UNLIMITED-allowance spenders, capped to the most recent
  // 20 — that's the actual risk signal, not every spender a wallet has ever touched. A heavily
  // used wallet can have 900+ historical spenders; checking each one individually against
  // Sourcify's public instance gets rate-limited (429, confirmed live) long before it finishes.
  const spendersToCheck = [
    ...new Set(approvals.filter((a) => a.isUnlimited).map((a) => a.spender)),
  ]
    .sort((a, b) => {
      const aApproval = approvals.find((x) => x.spender === a);
      const bApproval = approvals.find((x) => x.spender === b);
      return (aApproval?.lastUpdatedDaysAgo ?? Infinity) - (bApproval?.lastUpdatedDaysAgo ?? Infinity);
    })
    .slice(0, 20);

  const [contactedFlaggedAddresses, unverifiedApprovalSpenders] = await Promise.all([
    scamsniffer.filterFlagged(counterparties),
    sourcify.filterUnverified(spendersToCheck, config.sourcify.walletChainId),
  ]);

  const signals: AddressSignals = {
    address,
    walletAgeDays,
    totalTransfers,
    approvals,
    contactedFlaggedAddresses,
    unverifiedApprovalSpenders,
  };

  return score(signals);
}

function score(signals: AddressSignals): AddressRiskScore {
  let points = 0;
  const reasons: string[] = [];

  // Wallet age — newer wallets are riskier. Unknown age (no visible history at all in any of the
  // tracked tokens) is scored the same as brand-new — same risk treatment, since an unproven
  // wallet is exactly what the "new wallet" risk bucket is for — but the reason text says so
  // honestly instead of claiming a specific age it doesn't actually know.
  const age = signals.walletAgeDays ?? 0;
  if (signals.walletAgeDays === null) {
    points += 25;
    reasons.push("No visible transfer history found — treated as unproven/new");
  } else if (age < 7) {
    points += 25;
    reasons.push("Wallet is less than 7 days old");
  } else if (age < 30) {
    points += 12;
    reasons.push("Wallet is less than 30 days old");
  } else if (age > 365) {
    points -= 5;
    reasons.push("Wallet has over a year of history");
  }

  // Unlimited approvals — the actual attack surface for a drain.
  const unlimitedApprovals = signals.approvals.filter((a) => a.isUnlimited);
  if (unlimitedApprovals.length > 0) {
    points += Math.min(30, unlimitedApprovals.length * 8);
    reasons.push(`${unlimitedApprovals.length} unlimited token approval(s) active`);
  }

  // Unlimited approval to an unverified contract — the highest-signal combination.
  const riskyApprovals = unlimitedApprovals.filter((a) =>
    signals.unverifiedApprovalSpenders.includes(a.spender)
  );
  if (riskyApprovals.length > 0) {
    points += Math.min(30, riskyApprovals.length * 15);
    reasons.push(`${riskyApprovals.length} unlimited approval(s) to unverified contracts`);
  }

  // Stale approvals — old, forgotten, still live.
  const staleApprovals = signals.approvals.filter(
    (a) => a.isUnlimited && (a.lastUpdatedDaysAgo ?? 0) > 180
  );
  if (staleApprovals.length > 0) {
    points += 10;
    reasons.push(`${staleApprovals.length} approval(s) untouched for 6+ months`);
  }

  // Prior contact with a known-flagged address — hard signal, this is what actually
  // determines insurability, not just price.
  let declined = false;
  if (signals.contactedFlaggedAddresses.length > 0) {
    points += 100;
    declined = true;
    reasons.push(
      `Wallet has prior transfers with ${signals.contactedFlaggedAddresses.length} known-flagged address(es)`
    );
  }

  points = Math.max(0, Math.min(100, points));

  let tier: AddressRiskScore["tier"];
  if (declined) tier = "declined";
  else if (points < 20) tier = "low";
  else if (points < 50) tier = "medium";
  else tier = "high";

  const riskMultiplier = declined ? 0 : 0.5 + (points / 100) * 4.5; // 0.5x - 5x, matches quoteEngine's stated range

  if (reasons.length === 0) reasons.push("No elevated risk signals found");

  return { address: signals.address, score: points, riskMultiplier, tier, reasons, signals };
}

/**
 * Merges GoldRush's broad-coverage approvals snapshot with the subgraph's live feed for the
 * curated major-token set. Same (spender, token) pair from both sources is one signal, not two —
 * prefer the subgraph's freshness (lastUpdatedDaysAgo) when both report it, since that's indexed
 * within seconds of the on-chain event versus GoldRush's periodic snapshot.
 */
function mergeApprovals(goldrushApprovals: ApprovalSignal[], subgraphApprovals: ApprovalSignal[]): ApprovalSignal[] {
  const bySpenderToken = new Map<string, ApprovalSignal>();

  for (const a of goldrushApprovals) {
    bySpenderToken.set(`${a.spender}:${a.token}`, a);
  }
  for (const a of subgraphApprovals) {
    const key = `${a.spender}:${a.token}`;
    const existing = bySpenderToken.get(key);
    bySpenderToken.set(key, existing ? { ...existing, lastUpdatedDaysAgo: a.lastUpdatedDaysAgo } : a);
  }

  return [...bySpenderToken.values()];
}
