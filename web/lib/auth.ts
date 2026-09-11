"use client";

/**
 * Sign in with MetaMask — a real signature (personal_sign), not just "trust the connected
 * address." No gas, no transaction: the wallet signs a one-time challenge message, the backend
 * recovers the signing address from it and issues a session token. See
 * backend/src/routes/auth.ts for the verification side.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";
const STORAGE_KEY = "ripcord.session";

export interface Session {
  address: string;
  token: string;
}

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSessionStorage() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function signInWithMetaMask(): Promise<Session> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error("No injected wallet found — install MetaMask");

  // Same reasoning as connectWallet() in lib/chain.ts: force the account picker rather than
  // silently reusing whatever address was authorized last time.
  try {
    await ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
  } catch {
    // Some wallets don't support this, or the user dismissed it — fall through regardless.
  }

  const [address] = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];

  const nonceRes = await fetch(`${BACKEND_URL}/api/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!nonceRes.ok) throw new Error("Failed to get sign-in challenge from the server");
  const { message } = (await nonceRes.json()) as { message: string };

  // personal_sign — no gas, no transaction, just proves key ownership.
  const signature = (await ethereum.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;

  const verifyRes = await fetch(`${BACKEND_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature }),
  });
  if (!verifyRes.ok) {
    const body = await verifyRes.json().catch(() => ({}) as any);
    throw new Error(body.error ?? "Sign-in verification failed");
  }
  const { token } = (await verifyRes.json()) as { token: string };

  const session: Session = { address: address.toLowerCase(), token };
  saveSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  const session = loadSession();
  if (session) {
    await fetch(`${BACKEND_URL}/api/auth/signout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
    }).catch(() => {}); // best-effort — clear local state regardless
  }
  clearSessionStorage();
}

export async function getMyPolicies(session: Session) {
  const res = await fetch(`${BACKEND_URL}/api/policies/mine`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearSessionStorage(); // stale/expired session — drop it so the UI prompts sign-in again
    }
    throw new Error("Failed to load your policies");
  }
  return res.json();
}
