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
}
