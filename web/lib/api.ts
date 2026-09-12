import type { AddressRiskScore, Quote, Policy, Claim } from "./types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${path} failed: ${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

export function assessAddresses(addresses: string[]) {
  return request<{ scores: AddressRiskScore[] }>("/api/risk/assess", {
    method: "POST",
    body: JSON.stringify({ addresses }),
  });
}

export function getQuote(addresses: string[], coverageCapUsd: number) {
  return request<{ quote: Quote; scores: AddressRiskScore[] }>("/api/quote", {
    method: "POST",
    body: JSON.stringify({ addresses, coverageCapUsd }),
  });
}

export function registerBoundPolicy(payload: {
  holder: string;
  payoutAddress: string;
  coveredAddresses: string[];
  coverageCap: string;
  premiumPaid: string;
  expiry: string;
  onChainPolicyId: string;
  bindTxHash: string;
}) {
  return request<{ policy: Policy }>("/api/policy/bind", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPolicy(id: string) {
  return request<{ policy: Policy }>(`/api/policy/${id}`);
}

/** The real claims process: submits a transaction hash for the adjuster to independently verify
 * against Arc — never trusts the caller's word for what happened. Returns the finished claim
 * (approved-and-paid, or denied-with-reasoning) — a denial is a normal 201 response, not an
 * HTTP error, since the adjuster did its job correctly either way. */
export function submitClaim(policyId: string, txHash: string) {
  return request<{ claim: Claim }>("/api/claims", {
    method: "POST",
    body: JSON.stringify({ policyId, txHash }),
  });
}

export function getClaim(id: string) {
  return request<{ claim: Claim }>(`/api/claims/${id}`);
}

export function getClaimsForPolicy(policyId: string) {
  return request<{ claims: Claim[] }>(`/api/policy/${policyId}/claims`);
}
