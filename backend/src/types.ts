export type Address = `0x${string}`;

/** Raw signal readings for a single address, before scoring. */
export interface AddressSignals {
  address: Address;
  walletAgeDays: number | null; // lower-bound approximation — see graphTokenApi.ts's getWalletAgeDays
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
}

export interface Incident {
  policyId: string;
  triggerAddress: Address; // the flagged/anomalous destination
  fromAddress: Address; // the insured address that sent funds
  txHash: string;
  matchedReason: string;
  detectedAt: string;
}
