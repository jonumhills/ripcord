"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { TxChecklist, type TxStep } from "@/components/app/TxChecklist";
import { getQuote, registerBoundPolicy } from "@/lib/api";
import {
  connectWallet,
  ensureArcChain,
  requireSufficientBalance,
  approveUsdc,
  callBindPolicy,
  formatUsdcUnits,
} from "@/lib/chain";
import type { AddressRiskScore, Quote } from "@/lib/types";

const COVERAGE_DURATION_SECONDS = 365 * 24 * 60 * 60; // 1 year
const STEPS = ["Review", "Connect", "Sign"] as const;
const EXPLORER_TX_BASE = "https://testnet.arcscan.app/tx/";

function shortAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function shortHash(h: string) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
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

const INITIAL_TX_STEPS: TxStep[] = [
  { id: "wallet", label: "Wallet connected", status: "pending" },
  { id: "risk", label: "Risk analyzed", status: "pending" },
  { id: "premium", label: "Premium calculated", status: "pending" },
  { id: "balance", label: "Balance verified", status: "pending" },
  { id: "approve", label: "Approval signed", status: "pending" },
  { id: "bind", label: "Bind confirmed on Arc (USDC)", status: "pending" },
];

function BindPageInner() {
  const params = useSearchParams();
  const addresses = (params.get("addresses") ?? "").split(",").filter(Boolean);
  const coverageCapUsd = Number(params.get("coverageCapUsd") ?? 0);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [scores, setScores] = useState<AddressRiskScore[] | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [payoutAddress, setPayoutAddress] = useState("");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boundPolicyId, setBoundPolicyId] = useState<string | null>(null);
  const [txSteps, setTxSteps] = useState<TxStep[]>(INITIAL_TX_STEPS);

  function patchStep(id: string, patch: Partial<TxStep>) {
    setTxSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  useEffect(() => {
    if (addresses.length === 0 || !coverageCapUsd) return;
    getQuote(addresses, coverageCapUsd)
      .then((res) => {
        setQuote(res.quote);
        setScores(res.scores);
        const insurable = res.scores.filter((s) => s.tier !== "declined").length;
        const declined = res.scores.length - insurable;
        patchStep("risk", {
          status: "done",
          detail: declined > 0 ? `${insurable} insurable, ${declined} declined` : `${insurable} address(es), all insurable`,
        });
        patchStep("premium", {
          status: "done",
          detail: `$${formatUsdcUnits(BigInt(res.quote.totalPremium))} USDC/yr`,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.join(","), coverageCapUsd]);

  async function handleConnect() {
    try {
      const addr = await connectWallet();
      setAccount(addr);
      if (!payoutAddress) setPayoutAddress(addr);
      patchStep("wallet", { status: "done", detail: shortAddress(addr) });
      // Switch (and if needed, add) Arc Testnet right after connecting, not only right before
      // signing — so the wallet's network is visibly correct while the user is still reviewing
      // the quote, instead of a chain-switch prompt appearing out of nowhere at the sign step.
      await ensureArcChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleBind() {
    if (!account || !quote || !scores) return;
    setError(null);
    setSigning(true);

    // Only addresses that actually priced into this quote get covered on-chain — an earlier
    // version sent every address from the URL regardless of tier, which could bind a "declined"
    // address as covered even though its premium/coverage contribution was zero. The contract
    // has no concept of "declined"; that's purely this filtering that has to get it right.
    const insurableAddresses = scores
      .filter((s) => s.tier !== "declined")
      .map((s) => s.address) as `0x${string}`[];

    try {
      patchStep("balance", { status: "active" });
      await requireSufficientBalance(account, BigInt(quote.totalPremium));
      patchStep("balance", { status: "done", detail: "Sufficient USDC confirmed" });

      patchStep("approve", { status: "active" });
      const approveHash = await approveUsdc(account, BigInt(quote.totalPremium));
      patchStep("approve", { status: "done", detail: shortHash(approveHash), href: `${EXPLORER_TX_BASE}${approveHash}` });

      patchStep("bind", { status: "active" });
      const { bindTxHash, onChainPolicyId } = await callBindPolicy({
        account,
        coveredAddresses: insurableAddresses,
        payoutAddress: payoutAddress as `0x${string}`,
        coverageCap: BigInt(quote.totalCoverageCap),
        premium: BigInt(quote.totalPremium),
        durationSeconds: COVERAGE_DURATION_SECONDS,
      });
      patchStep("bind", { status: "done", detail: shortHash(bindTxHash), href: `${EXPLORER_TX_BASE}${bindTxHash}` });

      const { policy } = await registerBoundPolicy({
        holder: account,
        payoutAddress,
        coveredAddresses: insurableAddresses,
        coverageCap: quote.totalCoverageCap,
        premiumPaid: quote.totalPremium,
        expiry: new Date(Date.now() + COVERAGE_DURATION_SECONDS * 1000).toISOString(),
        onChainPolicyId,
        bindTxHash,
      });

      // Show an explicit success moment with a real choice of where to go next, rather than
      // silently yanking the page away the instant the last call resolves — the exact "no clean
      // flow to navigate to the dashboard" gap this was built to close.
      setSigning(false);
      setBoundPolicyId(policy.id);
    } catch (err) {
      setSigning(false);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      // Mark whichever step was in flight as failed, so the checklist shows where it broke.
      setTxSteps((prev) => {
        const activeIdx = prev.findIndex((s) => s.status === "active");
        if (activeIdx === -1) return prev;
        const next = [...prev];
        next[activeIdx] = { ...next[activeIdx], status: "error", detail: message };
        return next;
      });
    }
  }

  const currentStep = txSteps.find((s) => s.id === "bind")?.status === "done" ? 2 : account ? 1 : 0;

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
              <span className="font-mono text-sm">
                {scores?.filter((s) => s.tier !== "declined").length ?? addresses.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="label-caps">Coverage period</span>
              <span className="text-sm">1 year</span>
            </div>

            <div className="rounded-md bg-surface-2 border border-border px-5 py-4 flex items-center justify-between mt-1">
              <span className="label-caps">Total premium</span>
              <span className="font-display text-2xl text-primary">
                ${formatUsdcUnits(BigInt(quote.totalPremium))} USDC
              </span>
            </div>
          </div>
        )}

        {!account && !boundPolicyId && (
          <button className="btn btn-primary self-start" onClick={handleConnect}>
            Connect wallet
          </button>
        )}

        {account && !boundPolicyId && (
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
              {signing ? "Signing…" : "Pay premium & bind →"}
            </button>

            {(signing || txSteps.some((s) => s.status !== "pending")) && (
              <div className="pt-2 mt-1 border-t border-border">
                <TxChecklist steps={txSteps} />
              </div>
            )}
          </div>
        )}

        {boundPolicyId && (
          <div className="card card-accent fade-in-up flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary font-display text-base">
                ✓
              </span>
              <div>
                <span className="label-caps text-primary">Policy bound</span>
                <p className="text-fg mt-1.5 leading-relaxed">
                  You're covered. Automatic payout the moment a flagged drain hits an insured address — no claim to file.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href={`/app/policy/${boundPolicyId}`} className="btn btn-primary">
                View policy →
              </Link>
              <Link href="/dashboard" className="btn btn-secondary">
                Go to dashboard
              </Link>
            </div>
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
