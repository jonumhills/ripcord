export type Tier = "low" | "medium" | "high" | "declined";

export interface AddressRiskScore {
  address: string;
  score: number;
  riskMultiplier: number;
  tier: Tier;
  reasons: string[];
}

export interface QuoteLineItem {
  address: string;
  coverageCap: string;
  premium: string;
  tier: Tier;
}

export interface Quote {
  items: QuoteLineItem[];
  bundleDiscount: string;
  totalPremium: string;
  totalCoverageCap: string;
  expiresAt: string;
}

export interface Policy {
  id: string;
  holder: string;
  payoutAddress: string;
  coveredAddresses: string[];
  coverageCap: string;
  premiumPaid: string;
  startTime: string;
  expiry: string;
  active: boolean;
  claimed: boolean;
  onChainPolicyId: string | null;
  bindTxHash: string | null;
  claimedAt: string | null;
  claimTxHash: string | null;
  claimTriggerAddress: string | null;
}

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
  fromAddress: string | null;
  triggerAddress: string | null;
  tokenAddress: string | null;
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
