"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { getQuote, registerBoundPolicy } from "@/lib/api";
import { connectWallet, ensureArcChain, bindPolicyOnChain } from "@/lib/chain";
import type { Quote } from "@/lib/types";

const COVERAGE_DURATION_SECONDS = 365 * 24 * 60 * 60; // 1 year

export default function BindPage() {
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

  return (
    <>
      <Nav />
      <main className="wrap py-12 max-w-xl flex flex-col gap-6">
        <div>
          <h1 className="font-display font-semibold text-2xl">Bind your policy</h1>
          <p className="text-muted mt-2">
            This is the only step that touches your wallet — one approval, one signature, both on Arc.
          </p>
        </div>

        {!quote && !error && <p className="text-muted text-sm">Loading quote…</p>}
        {error && <p className="text-no-bg text-sm">{error}</p>}

        {quote && (
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="label-caps">Addresses covered</span>
              <span>{addresses.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="label-caps">Total premium</span>
              <span className="font-display text-lg text-primary">
                ${(Number(quote.totalPremium) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="label-caps">Coverage period</span>
              <span>1 year</span>
            </div>
          </div>
        )}

        {!account && (
          <button className="btn btn-primary self-start" onClick={handleConnect}>
            Connect wallet
          </button>
        )}

        {account && (
          <div className="flex flex-col gap-3">
            <label className="label-caps" htmlFor="payout">
              Payout address
            </label>
            <input
              id="payout"
              className="input"
              value={payoutAddress}
              onChange={(e) => setPayoutAddress(e.target.value)}
            />
            <p className="text-xs text-muted">
              Defaults to your connected wallet. Consider a separate address you control — if the
              insured wallet's key is ever compromised long-term, you don't want the payout going
              back into an attacker's reach.
            </p>

            <button
              className="btn btn-primary self-start mt-2"
              disabled={!quote || step === "approving" || step === "binding" || step === "registering"}
              onClick={handleBind}
            >
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
