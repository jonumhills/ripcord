"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PolicyCard } from "@/components/app/PolicyCard";
import { useAuth } from "@/lib/useAuth";
import { getMyPolicies } from "@/lib/auth";
import type { Policy } from "@/lib/types";

export default function DashboardPage() {
  const { session, hydrated, loading: authLoading, error: authError, signIn } = useAuth();
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getMyPolicies(session)
      .then((res) => !cancelled && setPolicies(res.policies))
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <>
      <Nav />
      <main className="wrap py-14 max-w-4xl flex flex-col gap-8">
        <div>
          <h1 className="font-display font-semibold text-3xl tracking-[-0.02em]">My wallets</h1>
          <p className="text-muted mt-2">Every policy tied to this address — as the one who paid, or the one covered.</p>
        </div>

        {!hydrated && <div className="h-32" />}

        {hydrated && !session && (
          <div className="card flex flex-col items-start gap-4 max-w-md">
            <span className="label-caps">Sign-in required</span>
            <p className="text-fg leading-relaxed">
              Sign a message with your wallet to see the policies tied to it — no gas, no
              transaction, just proof you hold the key.
            </p>
            <button className="btn btn-primary" onClick={signIn} disabled={authLoading}>
              {authLoading ? "Check your wallet…" : "Sign in with MetaMask →"}
            </button>
            {authError && <p className="text-no-bg text-sm">{authError}</p>}
          </div>
        )}

        {session && !policies && !loadError && (
          <div className="grid sm:grid-cols-2 gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="card h-[172px] animate-pulse bg-surface-2" />
            ))}
          </div>
        )}

        {loadError && <p className="text-no-bg text-sm">{loadError}</p>}

        {session && policies && policies.length === 0 && (
          <div className="card flex flex-col items-start gap-4 max-w-md">
            <span className="label-caps">Nothing here yet</span>
            <p className="text-fg leading-relaxed">
              You haven't insured any wallets with this address. Get a free risk check and a quote
              in under a minute.
            </p>
            <Link href="/app" className="btn btn-primary">
              Check your risk →
            </Link>
          </div>
        )}

        {session && policies && policies.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-5">
            {policies.map((p) => (
              <PolicyCard key={p.id} policy={p} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
