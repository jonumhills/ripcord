export type Address = `0x${string}`;

/** Raw signal readings for a single address, before scoring. */
export interface AddressSignals {
  address: Address;
  walletAgeDays: number | null; // lower-bound approximation — see graphTokenApi.ts's getWalletActivitySummary
  totalTransfers: number; // capped at 20 (10 per direction) by the Token API plan's limit — see graphTokenApi.ts
  approvals: ApprovalSignal[];
  contactedFlaggedAddresses: Address[];
  unverifiedApprovalSpenders: Address[];
}

export interface ApprovalSignal {
  spender: Address;
  token: Address;
  isUnlimited: boolean;
  lastUpdatedDaysAgo: number | null;
}

/** Scored output for a single address — what the quote engine and the UI both consume. */
export interface AddressRiskScore {
  address: Address;
  score: number; // 0 (safest) - 100 (most risky)
  riskMultiplier: number; // applied to base premium rate
  tier: "low" | "medium" | "high" | "declined";
  reasons: string[];
  signals: AddressSignals;
}

export interface QuoteLineItem {
  address: Address;
  coverageCap: string; // USDC, string to avoid float precision issues
  premium: string; // USDC
  tier: AddressRiskScore["tier"];
}

export interface Quote {
  items: QuoteLineItem[];
  bundleDiscount: string; // USDC, administrative-only — see quoteEngine.ts
  totalPremium: string; // USDC
  totalCoverageCap: string; // USDC
  expiresAt: string; // ISO — quotes are only valid briefly, risk data moves
}

export interface Policy {
  id: string;
  holder: Address;
  payoutAddress: Address;
  coveredAddresses: Address[];
  coverageCap: string;
  premiumPaid: string;
  startTime: string;
  expiry: string;
  active: boolean;
  claimed: boolean;
  onChainPolicyId: string | null; // set once bindPolicy() confirms on Arc
  bindTxHash: string | null;
  // Set together by claimsAgent.ts the moment payClaim() confirms — previously `claimed` was a
  // bare boolean with no record of when, how much, or why, which is exactly what a "claims"
  // view needs to be more than a status dot. All null until claimed.
  claimedAt: string | null;
  claimTxHash: string | null;
  claimTriggerAddress: Address | null; // the flagged destination that triggered the payout
}

/**
 * pending  — submitted, adjuster hasn't finished review
 * approved — adjuster verified it's a covered drain; about to attempt payout
 * denied   — adjuster rejected it; `reasoning` explains why, nothing gets paid
 * paying   — payout transaction submitted, awaiting confirmation
 * paid     — payout confirmed on-chain — terminal success
 * failed   — was approved, but the on-chain payout itself failed (e.g. the claims agent ran out
 *            of gas — a real failure mode this caught live) — terminal, but distinguishable from
 *            "denied" since the claim itself was valid, only the execution failed
 */
export type ClaimStatus = "pending" | "approved" | "denied" | "paying" | "paid" | "failed";

export interface ClaimCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface Claim {
  id: string;
  policyId: string;
  submittedTxHash: string;
  status: ClaimStatus;
  fromAddress: Address | null;
  triggerAddress: Address | null;
  tokenAddress: Address | null;
  amount: string | null;
  verdict: "approved" | "denied" | null;
  reasoning: string | null;
  checks: ClaimCheck[] | null;
  payoutTxHash: string | null;
  failureReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
}
