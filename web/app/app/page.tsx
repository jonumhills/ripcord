"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { AddressForm } from "@/components/app/AddressForm";
import { RiskCard } from "@/components/app/RiskCard";
import { QuotePanel } from "@/components/app/QuotePanel";
import { assessAddresses, getQuote } from "@/lib/api";
import type { AddressRiskScore, Quote } from "@/lib/types";

export default function AppPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<string[]>([]);
  const [scores, setScores] = useState<AddressRiskScore[] | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [coverageCapUsd, setCoverageCapUsd] = useState(1000);
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

  return (
    <>
      <Nav />
      <main className="wrap py-12 max-w-2xl flex flex-col gap-6">
        <div>
          <h1 className="font-display font-semibold text-2xl">Get covered</h1>
          <p className="text-muted mt-2">Add, assess, quote, bind — in one flow.</p>
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
          <button className="btn btn-primary self-start" onClick={handleCheckRisk} disabled={loading}>
            {loading ? "Scoring…" : "Check risk →"}
          </button>
        )}

        {error && <p className="text-no-bg text-sm">{error}</p>}

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
          </div>
        )}
      </main>
    </>
  );
}
