"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { getQuote, registerBoundPolicy } from "@/lib/api";
import { connectWallet, ensureArcChain, bindPolicyOnChain } from "@/lib/chain";
import type { Quote } from "@/lib/types";

const COVERAGE_DURATION_SECONDS = 365 * 24 * 60 * 60; // 1 year
const STEPS = ["Review", "Connect", "Sign"] as const;

function shortAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function StepTracker({ current }: { current: number }) {
  return (
    <div className="steps">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className={`step ${i < current ? "step-done" : i === current ? "step-active" : ""}`}>
            <span className="step-dot">{i + 1}</span>
            <span>{label}</span>
          </div>
          {i < STEPS.length - 1 && <span className="step-line mx-2" />}
        </div>
      ))}
    </div>
  );
}

function BindPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const addresses = (params.get("addresses") ?? "").split(",").filter(Boolean);
  const coverageCapUsd = Number(params.get("coverageCapUsd") ?? 0);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [payoutAddress, setPayoutAddress] = useState("");
  const [step, setStep] = useState<"review" | "approving" | "binding" | "registering" | "done" | "error">("review");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (addresses.length === 0 || !coverageCapUsd) return;
    getQuote(addresses, coverageCapUsd)
      .then((res) => setQuote(res.quote))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [addresses.join(","), coverageCapUsd]);

  async function handleConnect() {
    try {
      const addr = await connectWallet();
      setAccount(addr);
      if (!payoutAddress) setPayoutAddress(addr);
      // Switch (and if needed, add) Arc Testnet right after connecting, not only right before
      // signing — so the wallet's network is visibly correct while the user is still reviewing
      // the quote, instead of a chain-switch prompt appearing out of nowhere at the sign step.
      await ensureArcChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleBind() {
    if (!account || !quote) return;
    setError(null);
    try {
      setStep("approving");
      const { bindTxHash, onChainPolicyId } = await bindPolicyOnChain({
        account,
        coveredAddresses: addresses as `0x${string}`[],
        payoutAddress: payoutAddress as `0x${string}`,
        // Reuse the quote's own total rather than recomputing from coverageCapUsd — it already
        // excludes declined addresses, so it's the true on-chain coverage cap for this policy.
        coverageCap: BigInt(quote.totalCoverageCap),
        premium: BigInt(quote.totalPremium),
        durationSeconds: COVERAGE_DURATION_SECONDS,
      });

      setStep("registering");
      const { policy } = await registerBoundPolicy({
        holder: account,
        payoutAddress,
        coveredAddresses: addresses,
        coverageCap: quote.totalCoverageCap,
        premiumPaid: quote.totalPremium,
        expiry: new Date(Date.now() + COVERAGE_DURATION_SECONDS * 1000).toISOString(),
        onChainPolicyId,
        bindTxHash,
      });

      setStep("done");
      router.push(`/app/policy/${policy.id}`);
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const signing = step === "approving" || step === "binding" || step === "registering";
  const currentStep = signing || step === "done" ? 2 : account ? 1 : 0;

  return (
    <>
      <Nav />
      <main className="wrap py-14 max-w-xl flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="font-display font-semibold text-3xl tracking-[-0.02em]">Bind your policy</h1>
            <p className="text-muted mt-2 leading-relaxed">
              This is the only step that touches your wallet — one approval, one signature, both on Arc.
            </p>
          </div>
          <StepTracker current={currentStep} />
        </div>

        {!quote && !error && <div className="card h-32 animate-pulse bg-surface-2" />}
        {error && <p className="text-no-bg text-sm">{error}</p>}

        {quote && (
          <div className="card fade-in-up flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="label-caps">Addresses covered</span>
              <span className="font-mono text-sm">{addresses.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="label-caps">Coverage period</span>
              <span className="text-sm">1 year</span>
            </div>

            <div className="rounded-md bg-surface-2 border border-border px-5 py-4 flex items-center justify-between mt-1">
              <span className="label-caps">Total premium</span>
              <span className="font-display text-2xl text-primary">
                ${(Number(quote.totalPremium) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
              </span>
            </div>
          </div>
        )}

        {!account && (
          <button className="btn btn-primary self-start" onClick={handleConnect}>
            Connect wallet
          </button>
        )}

        {account && (
          <div className="card fade-in-up flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted">Connected</span>
              <span className="font-mono">{shortAddress(account)}</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="label-caps" htmlFor="payout">
                Payout address
              </label>
              <input
                id="payout"
                className="input"
                value={payoutAddress}
                onChange={(e) => setPayoutAddress(e.target.value)}
              />
              <p className="text-xs text-muted leading-relaxed">
                Defaults to your connected wallet. Consider a separate address you control — if the
                insured wallet's key is ever compromised long-term, you don't want the payout going
                back into an attacker's reach.
              </p>
            </div>

            <button className="btn btn-primary self-start" disabled={!quote || signing} onClick={handleBind}>
              {step === "approving" && "Approving USDC…"}
              {step === "binding" && "Binding policy…"}
              {step === "registering" && "Finishing up…"}
              {(step === "review" || step === "error") && "Pay premium & bind →"}
            </button>
          </div>
        )}
      </main>
    </>
  );
}

// useSearchParams() requires a Suspense boundary even on a fully client-rendered page — Next
// bails the whole build otherwise ("should be wrapped in a suspense boundary"), confirmed by
// `next build` actually failing on this page before this wrapper was added.
export default function BindPage() {
  return (
    <Suspense fallback={<div className="wrap py-14 max-w-xl"><div className="card h-40 animate-pulse bg-surface-2" /></div>}>
      <BindPageInner />
    </Suspense>
  );
}
