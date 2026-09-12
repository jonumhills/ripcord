import Link from "next/link";

export function Hero() {
  return (
    <section className="wrap pt-24 pb-24">
      <span className="label-caps">Parametric wallet insurance</span>
      <h1 className="font-display font-semibold text-fg mt-4 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.035em] max-w-3xl">
        Get paid the moment your wallet is drained. No claim to file.
      </h1>
      <p className="text-muted text-base md:text-lg mt-6 max-w-xl leading-relaxed">
        Add any address. Get a live risk score computed from real on-chain data. Get a quote.
        Get covered. If a covered wallet sends funds to a known-flagged address, your payout is
        automatic — no claims form, no DAO vote, no waiting on an assessor.
      </p>
      <div className="flex items-center gap-3 mt-8">
        <Link href="/app" className="btn btn-primary">
          Check your risk, free →
        </Link>
        <a href="#how-it-works" className="btn btn-secondary">
          How it works
        </a>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Add addresses",
      body: "Connect a wallet or paste any address — you don't need the keys to insure it.",
    },
    {
      n: "02",
      title: "Live risk score",
      body: "Wallet age, unlimited approvals, prior contact with flagged addresses, contract verification — all pulled live, not cached.",
    },
    {
      n: "03",
      title: "Quote & bind",
      body: "Risk-priced premium per address. Pay once in USDC, sign once. Your policy is a record on-chain, not a PDF.",
    },
    {
      n: "04",
      title: "Automatic payout",
      body: "A monitoring agent watches your covered addresses. A flagged-destination drain triggers a payout by itself — no form, no vote.",
    },
  ];

  return (
    <section id="how-it-works" className="wrap py-24 border-t border-border">
      <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-[-0.02em]">How it works</h2>
      <div className="grid md:grid-cols-4 gap-6 mt-12">
        {steps.map((s) => (
          <div key={s.n} className="card">
            <span className="font-display text-primary text-sm">{s.n}</span>
            <h3 className="text-base font-semibold mt-3">{s.title}</h3>
            <p className="text-muted text-sm mt-2 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
