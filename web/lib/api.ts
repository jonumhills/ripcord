import type { AddressRiskScore, Quote, Policy } from "./types";

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

/** Demo-only: fires the same claims-agent path the live monitor uses, on cue. See backend/README.md. */
export function simulateIncident(payload: {
  policyId: string;
  triggerAddress: string;
  fromAddress: string;
  txHash: string;
}) {
  return request<{ status: string }>("/api/demo/simulate-incident", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
