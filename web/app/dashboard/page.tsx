"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PolicyCard } from "@/components/app/PolicyCard";
import { ClaimCard } from "@/components/app/ClaimCard";
import { useAuth } from "@/lib/useAuth";
import { getMyPolicies } from "@/lib/auth";
import type { Policy } from "@/lib/types";

type Tab = "policies" | "claims";

export default function DashboardPage() {
  const { session, hydrated, loading: authLoading, error: authError, signIn } = useAuth();
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("policies");

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

  const claims = useMemo(() => (policies ?? []).filter((p) => p.claimed), [policies]);
  const unclaimedPolicies = useMemo(() => (policies ?? []).filter((p) => !p.claimed), [policies]);

  return (
    <>
      <Nav />
      <main className="wrap py-14 max-w-4xl flex flex-col gap-8">
        <div>
          <h1 className="font-display font-semibold text-3xl tracking-[-0.02em]">My wallets</h1>
          <p className="text-muted mt-2">Every policy tied to this address, and every claim it's paid out.</p>
        </div>

        {!hydrated && <div className="h-32" />}

        {hydrated && !session && (
          <div className="card flex flex-col items-start gap-4 max-w-md">
            <span className="label-caps">Sign-in required</span>
            <p className="text-fg leading-relaxed">
              Sign a message with your wallet to see the policies and claims tied to it — no gas,
              no transaction, just proof you hold the key.
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
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-1 border-b border-border">
              <button
                className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                  tab === "policies" ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
                onClick={() => setTab("policies")}
              >
                Policies
                <span className="ml-1.5 text-xs text-muted">{unclaimedPolicies.length}</span>
              </button>
              <button
                className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                  tab === "claims" ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
                onClick={() => setTab("claims")}
              >
                Claims
                <span className="ml-1.5 text-xs text-muted">{claims.length}</span>
              </button>
            </div>

            {tab === "policies" && (
              unclaimedPolicies.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-5 fade-in-up">
                  {unclaimedPolicies.map((p) => (
                    <PolicyCard key={p.id} policy={p} />
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">No active policies — every coverage you've bound has already paid a claim.</p>
              )
            )}

            {tab === "claims" && (
              claims.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-5 fade-in-up">
                  {claims.map((p) => (
                    <ClaimCard key={p.id} policy={p} />
                  ))}
                </div>
              ) : (
                <div className="card flex flex-col items-start gap-2 max-w-md">
                  <span className="label-caps">No claims yet</span>
                  <p className="text-muted text-sm leading-relaxed">
                    Good news — none of your covered wallets have been drained. A claim pays out
                    automatically the moment one is, no form to file.
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </main>
    </>
  );
}
