import type { AddressRiskScore, Quote } from "./types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8080";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${path} failed: ${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

export function assessAddresses(addresses: string[]) {
  return post<{ scores: AddressRiskScore[] }>("/api/risk/assess", { addresses });
}

export function getQuote(addresses: string[], coverageCapUsd: number) {
  return post<{ quote: Quote; scores: AddressRiskScore[] }>("/api/quote", { addresses, coverageCapUsd });
}
