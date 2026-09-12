const COMPETITORS = [
  { name: "Ripcord", trigger: "Flagged on-chain destination", payout: "Automatic", speed: "Seconds" },
  { name: "Fairside", trigger: "Security Council review", payout: "DAO vote", speed: "Days" },
  { name: "MetaMask Protection", trigger: "Claim filed within 21 days", payout: "Manual review", speed: "Days" },
  { name: "Nexus Mutual", trigger: "Protocol exploit", payout: "Member vote", speed: "Days" },
];

export function TrustSection() {
  return (
    <section className="wrap py-24 border-t border-border">
      <span className="label-caps">Why parametric</span>
      <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-[-0.02em] mt-3">
        Every other wallet cover makes you file a claim first
      </h2>
      <p className="text-muted mt-4 max-w-2xl leading-relaxed">
        Ripcord doesn't assess loss after the fact — it prices and pays against a defined,
        provable trigger: your covered wallet sending funds to an address already known to be a
        drainer. That's provable, unfakeable, and fast. The trade-off, stated plainly: coverage is
        narrower than a human-reviewed claim, because we only pay on triggers we can prove
        on-chain — not on every conceivable way to lose funds.
      </p>

      <div className="overflow-x-auto mt-10">
        <table className="w-full text-sm border-collapse min-w-[560px]">
          <thead>
            <tr className="text-left label-caps border-b border-border">
              <th className="py-3 pr-4">Product</th>
              <th className="py-3 pr-4">Trigger</th>
              <th className="py-3 pr-4">Adjudication</th>
              <th className="py-3">Payout speed</th>
            </tr>
          </thead>
          <tbody>
            {COMPETITORS.map((c) => (
              <tr key={c.name} className={`border-b border-border ${c.name === "Ripcord" ? "text-primary" : "text-fg"}`}>
                <td className="py-3 pr-4 font-medium">{c.name}</td>
                <td className="py-3 pr-4 text-muted">{c.trigger}</td>
                <td className="py-3 pr-4 text-muted">{c.payout}</td>
                <td className="py-3">{c.speed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="wrap py-24 border-t border-border">
      <span className="label-caps">Pricing</span>
      <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-[-0.02em] mt-3">
        Risk-priced, not flat-rate
      </h2>
      <p className="text-muted mt-4 max-w-2xl leading-relaxed">
        Premium = base rate × coverage cap × your wallet's risk multiplier. A clean wallet with no
        stale approvals pays less than one with three unlimited approvals to unverified contracts.
        Bundling multiple addresses gets a small administrative discount, never a risk discount —
        one compromised seed phrase can drain every address you hold at once, so the risk is
        correlated, not diversified. A wallet with prior contact with a known-flagged address isn't
        priced higher — it's declined outright.
      </p>
      <div className="card mt-8 max-w-md">
        <div className="flex items-baseline justify-between">
          <span className="label-caps">Base annual rate</span>
          <span className="font-display text-xl text-primary">1.5%</span>
        </div>
        <p className="text-muted text-sm mt-2">of coverage cap, before your risk multiplier is applied</p>
      </div>
    </section>
  );
}
