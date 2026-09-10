import type { Address, AddressRiskScore, Quote, QuoteLineItem } from "../types.js";

/**
 * Premium = BaseRate x CoverageCap x RiskMultiplier, annualized.
 *
 * Two deliberate underwriting rules, stated here because they're what makes this look like
 * real insurance rather than a arbitrary formula:
 *  1. A "declined" address (prior contact with a known-flagged address) is not insurable at any
 *     price — flat decline, not a high premium. Insuring it would be adverse selection.
 *  2. Bundling multiple addresses from the same holder gets a small administrative discount only,
 *     never a risk discount — one compromised seed phrase can drain every bundled address at once,
 *     so the risk is correlated, not diversified.
 */

const BASE_ANNUAL_RATE = 0.015; // 1.5%, undercutting Fairside's 1.95% on the strength of automation
const BUNDLE_ADMIN_DISCOUNT_RATE = 0.05; // 5% off total premium for 2+ addresses, admin cost only
const QUOTE_VALIDITY_MINUTES = 15;

export function buildQuote(scores: AddressRiskScore[], coverageCapPerAddress: bigint): Quote {
  const items: QuoteLineItem[] = [];
  let totalPremium = 0n;
  let totalCoverage = 0n;

  for (const s of scores) {
    if (s.tier === "declined") {
      items.push({
        address: s.address,
        coverageCap: "0",
        premium: "0",
        tier: "declined",
      });
      continue;
    }

    const premium = annualPremium(coverageCapPerAddress, s.riskMultiplier);
    totalPremium += premium;
    totalCoverage += coverageCapPerAddress;

    items.push({
      address: s.address,
      coverageCap: coverageCapPerAddress.toString(),
      premium: premium.toString(),
      tier: s.tier,
    });
  }

  const insurableCount = items.filter((i) => i.tier !== "declined").length;
  const bundleDiscount =
    insurableCount >= 2 ? (totalPremium * BigInt(Math.round(BUNDLE_ADMIN_DISCOUNT_RATE * 1000))) / 1000n : 0n;

  return {
    items,
    bundleDiscount: bundleDiscount.toString(),
    totalPremium: (totalPremium - bundleDiscount).toString(),
    totalCoverageCap: totalCoverage.toString(),
    expiresAt: new Date(Date.now() + QUOTE_VALIDITY_MINUTES * 60 * 1000).toISOString(),
  };
}

function annualPremium(coverageCap: bigint, riskMultiplier: number): bigint {
  // riskMultiplier carries 2 decimal places of precision via integer math to avoid floats on-chain-adjacent values
  const rateBasisPoints = BigInt(Math.round(BASE_ANNUAL_RATE * riskMultiplier * 10_000));
  return (coverageCap * rateBasisPoints) / 10_000n;
}

export function coverageCapFromUsd(usd: number, usdcDecimals = 6): bigint {
  return BigInt(Math.round(usd * 10 ** usdcDecimals));
}
