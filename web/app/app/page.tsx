"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { AddressForm } from "@/components/app/AddressForm";
import { RiskCard } from "@/components/app/RiskCard";
import { QuotePanel } from "@/components/app/QuotePanel";
import { assessAddresses, getQuote } from "@/lib/api";
import type { AddressRiskScore, Quote } from "@/lib/types";

const STEPS = ["Add", "Risk", "Quote"] as const;

function StepTracker({ current }: { current: number }) {
  return (
    <div className="steps">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className={`step ${i < current ? "step-done" : i === current ? "step-active" : ""}`}>
            <span className="step-dot">{i + 1}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < STEPS.length - 1 && <span className="step-line mx-2" />}
        </div>
      ))}
    </div>
  );
}

export default function AppPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<string[]>([]);
  const [scores, setScores] = useState<AddressRiskScore[] | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [coverageCapUsd, setCoverageCapUsd] = useState(10); // slider min — cheapest possible premium for testing; drag up for a realistic quote
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckRisk() {
    setLoading(true);
    setError(null);
    try {
      const res = await assessAddresses(addresses);
      setScores(res.scores);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!scores) return;
    let cancelled = false;
    getQuote(addresses, coverageCapUsd)
      .then((res) => !cancelled && setQuote(res.quote))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [scores, addresses, coverageCapUsd]);

  function handleGetCovered() {
    const params = new URLSearchParams({
      addresses: addresses.join(","),
      coverageCapUsd: String(coverageCapUsd),
    });
    router.push(`/bind?${params.toString()}`);
  }

  const anyInsurable = scores?.some((s) => s.tier !== "declined") ?? false;
  const currentStep = quote ? 2 : scores ? 1 : 0;

  return (
    <>
      <Nav />
      <main className="wrap py-14 max-w-2xl flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="font-display font-semibold text-3xl tracking-[-0.02em]">Get covered</h1>
            <p className="text-muted mt-2">Add, assess, quote, bind — in one flow, under a minute.</p>
          </div>
          <StepTracker current={currentStep} />
        </div>

        <AddressForm
          addresses={addresses}
          onAddAddress={(a) => {
            setAddresses((prev) => [...prev, a]);
            setScores(null);
            setQuote(null);
          }}
          onRemoveAddress={(a) => {
            setAddresses((prev) => prev.filter((x) => x !== a));
            setScores(null);
            setQuote(null);
          }}
        />

        {addresses.length > 0 && !scores && (
          <button className="btn btn-primary self-start -mt-3" onClick={handleCheckRisk} disabled={loading}>
            {loading ? "Scoring…" : "Check risk →"}
          </button>
        )}

        {error && <p className="text-no-bg text-sm">{error}</p>}

        {loading && (
          <div className="flex flex-col gap-3">
            <div className="card h-24 animate-pulse bg-surface-2" />
          </div>
        )}

        {scores && (
          <div className="flex flex-col gap-4">
            <h2 className="label-caps">Risk assessment</h2>
            {scores.map((s) => (
              <RiskCard key={s.address} score={s} />
            ))}
          </div>
        )}

        {scores && quote && (
          <div className="flex flex-col gap-4">
            <h2 className="label-caps">Quote</h2>
            <QuotePanel quote={quote} coverageCapUsd={coverageCapUsd} onCoverageCapChange={setCoverageCapUsd} />
            <button
              className="btn btn-primary self-start"
              disabled={!anyInsurable || Number(quote.totalPremium) === 0}
              onClick={handleGetCovered}
            >
              Get covered →
            </button>
            {!anyInsurable && (
              <p className="text-xs text-muted -mt-2">
                Every address here was declined — prior contact with a known-flagged address means it isn't insurable at any price.
              </p>
            )}
          </div>
        )}
      </main>
    </>
  );
}
