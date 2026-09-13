import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BrandMark } from "@/components/BrandMark";
import { CopyButton } from "@/components/media-kit/CopyButton";
import { TrustSection } from "@/components/marketing/TrustPricing";

export const metadata: Metadata = {
  title: "Ripcord — Media kit",
  description: "Logo files, colors, type, boilerplate copy, and key facts for writing about or building with Ripcord.",
};

const SHORT = "Parametric wallet insurance: submit a tx hash, an automated adjuster verifies and pays in seconds.";
const MEDIUM =
  "Ripcord is parametric insurance for retail crypto wallets. Add an address, get a live on-chain risk score, and bind a policy in USDC on Arc testnet. If the wallet gets drained, file a claim with just the transaction hash: an automated adjuster verifies the drain directly on-chain and pays out in seconds, with no claims committee and no vote.";
const LONG = `Ripcord is parametric insurance for retail wallets. Add any address, get a live risk score computed from real on-chain data (wallet age, unlimited approvals, prior contact with flagged addresses, contract verification), get a risk-priced USDC quote, and bind a policy on Arc testnet. It's self-custodial the whole way; the backend never touches your premium.

If your wallet gets drained, paste the transaction hash into a claim. An automated adjuster independently re-reads that exact transaction from the chain instead of trusting your word for what happened. It confirms the sender is a covered address and the destination is a known-malicious one, and if both hold, pays your full coverage cap in USDC within seconds.

No claims committee, no DAO vote, no days-long wait. Every other wallet-cover product (Fairside, MetaMask Protection, Nexus Mutual) routes a claim to a human or a vote. Ripcord covers one narrow, provable trigger: an outgoing transfer to an address already known to be malicious. In exchange, the payout is instant and deterministic instead of discretionary.`;

const SWATCHES = [
  { name: "Background", hex: "#0b0d0b", role: "Dark surface, primary ground" },
  { name: "Surface", hex: "#131613", role: "Cards, raised panels" },
  { name: "Accent, dark mode", hex: "#33e667", role: "Primary, on dark surfaces" },
  { name: "Accent, light mode", hex: "#0b7c39", role: "Primary, on light surfaces" },
  { name: "Foreground", hex: "#e8e6e0", role: "Body text, dark mode" },
  { name: "Muted", hex: "#9aa29a", role: "Secondary text, labels" },
  { name: "Border", hex: "#262b26", role: "Hairlines, dividers" },
  { name: "Caution", hex: "#ffb000", role: "Medium-risk state" },
  { name: "Danger", hex: "#f44", role: "High-risk, declined states" },
];

const FACTS: [string, React.ReactNode][] = [
  ["Category", "Parametric wallet insurance"],
  ["Settlement chain", "Arc testnet, chain ID 5042002"],
  ["Currency", "USDC only, including gas"],
  [
    "PolicyVault",
    <a key="v" href="https://testnet.arcscan.app/address/0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855" target="_blank" rel="noreferrer" className="text-primary hover:underline">
      0x4345…89855 ↗
    </a>,
  ],
  ["Contracts", "Solidity, Foundry, 11/11 tests"],
  ["Backend", "Fastify + TypeScript"],
  ["Data sources", "The Graph, ScamSniffer, Sourcify"],
  ["Storage", "Postgres via Supabase"],
  ["Clients", "Next.js web app, Manifest V3 extension"],
  ["Built for", "ETHGlobal Online, 2026"],
];

export default function MediaKitPage() {
  return (
    <>
      <Nav />
      <main className="wrap py-14 flex flex-col gap-20 max-w-4xl">
        <div>
          <BrandMark className="h-14 w-14 text-primary mb-6" />
          <span className="label-caps">Media kit</span>
          <h1 className="font-display font-semibold text-3xl md:text-4xl tracking-[-0.02em] mt-2 max-w-lg">
            Ripcord, in one page
          </h1>
          <p className="text-muted mt-4 max-w-xl leading-relaxed">
            Logo files, colors, type, boilerplate copy, and the facts a press writeup or partner
            deck needs. Text is copy-pasteable; the logo is a real download.
          </p>
        </div>

        {/* Boilerplate */}
        <section className="flex flex-col gap-5">
          <div>
            <span className="label-caps">Boilerplate</span>
            <h2 className="font-display font-semibold text-xl mt-1">Descriptions, three lengths</h2>
          </div>

          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="label-caps">Short (98 characters)</span>
              <CopyButton text={SHORT} />
            </div>
            <p className="text-sm leading-relaxed">{SHORT}</p>
          </div>

          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="label-caps">Medium</span>
              <CopyButton text={MEDIUM} />
            </div>
            <p className="text-sm leading-relaxed">{MEDIUM}</p>
          </div>

          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="label-caps">Long</span>
              <CopyButton text={LONG} />
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-line">{LONG}</p>
          </div>
        </section>

        {/* Logo */}
        <section className="flex flex-col gap-5">
          <div>
            <span className="label-caps">Logo</span>
            <h2 className="font-display font-semibold text-xl mt-1">The mark</h2>
            <p className="text-muted text-sm mt-2 max-w-xl leading-relaxed">
              Just a circle, one flat color, no ornament. Same mark used in the nav above and as
              the browser-tab favicon.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border flex flex-col items-center justify-center gap-4 py-12" style={{ background: "#0b0d0b" }}>
              <BrandMark className="h-14 w-14" style={{ color: "#33e667" }} />
              <span className="text-xs" style={{ color: "#9aa29a" }}>On dark &middot; #33e667</span>
            </div>
            <div className="rounded-lg border flex flex-col items-center justify-center gap-4 py-12" style={{ background: "#f7f8f9", borderColor: "#d8dbe1" }}>
              <BrandMark className="h-14 w-14" style={{ color: "#0b7c39" }} />
              <span className="text-xs" style={{ color: "#5b6370" }}>On light &middot; #0b7c39</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href="/logo/ripcord-mark.svg" download className="btn btn-primary !text-sm">
              Download SVG (green) &darr;
            </a>
            <a href="/logo/ripcord-mark-white.svg" download className="btn btn-secondary !text-sm">
              White SVG &darr;
            </a>
            <a href="/logo/ripcord-mark-black.svg" download className="btn btn-secondary !text-sm">
              Black SVG &darr;
            </a>
            <a href="/media-kit/mark.png" download="ripcord-mark.png" className="btn btn-secondary !text-sm">
              PNG, 512&times;512 &darr;
            </a>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mt-2">
            <p className="text-xs text-muted leading-relaxed">
              <b className="text-fg block mb-1">Keep it flat.</b>
              One solid fill, no gradient, no outline, no drop shadow.
            </p>
            <p className="text-xs text-muted leading-relaxed">
              <b className="text-fg block mb-1">Give it room.</b>
              Leave clearspace around it equal to at least a quarter of its diameter.
            </p>
            <p className="text-xs text-muted leading-relaxed">
              <b className="text-fg block mb-1">Don&rsquo;t stretch it.</b>
              Scale it proportionally rather than distorting it into an oval.
            </p>
          </div>
        </section>

        {/* Color */}
        <section className="flex flex-col gap-5">
          <div>
            <span className="label-caps">Color</span>
            <h2 className="font-display font-semibold text-xl mt-1">Palette</h2>
            <p className="text-muted text-sm mt-2 max-w-xl leading-relaxed">
              Dark is the primary surface. The accent shifts between dark and light mode for
              contrast, same as the product itself.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SWATCHES.map((s) => (
              <div key={s.hex} className="rounded-lg border border-border overflow-hidden">
                <div className="h-16" style={{ background: s.hex }} />
                <div className="p-3 bg-surface flex flex-col gap-2">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted mt-0.5">{s.role}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted font-mono">{s.hex}</span>
                    <CopyButton text={s.hex} label="copy" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section className="flex flex-col gap-5">
          <div>
            <span className="label-caps">Typography</span>
            <h2 className="font-display font-semibold text-xl mt-1">Two typefaces, one job each</h2>
          </div>
          <div className="flex flex-col gap-6">
            <div>
              <span className="label-caps">Display &middot; Space Grotesk</span>
              <p className="font-display font-semibold text-3xl md:text-4xl tracking-[-0.02em] mt-2">
                No human ever reviews it.
              </p>
            </div>
            <div>
              <span className="label-caps">Mono &middot; JetBrains Mono</span>
              <p className="text-sm text-muted mt-2 leading-relaxed max-w-xl">
                Body copy, uppercase eyebrow labels, and every address or transaction hash render
                in JetBrains Mono. ABCDEFGHIJKLMNOPQRSTUVWXYZ &middot; abcdefghijklmnopqrstuvwxyz
                &middot; 0123456789 &middot; 0x4345b8Ba&hellip;cb89855
              </p>
            </div>
          </div>
        </section>

        {/* Why parametric, reused directly from the marketing page */}
        <div className="-mx-6">
          <TrustSection />
        </div>

        {/* Fast facts */}
        <section className="flex flex-col gap-5">
          <div>
            <span className="label-caps">Fast facts</span>
            <h2 className="font-display font-semibold text-xl mt-1">For the write-up</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8">
            {FACTS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-3 border-b border-border text-sm">
                <span className="text-muted shrink-0">{k}</span>
                <span className="text-right break-all">{v}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Links */}
        <section className="flex flex-col gap-3">
          <span className="label-caps">Elsewhere</span>
          <a
            href="https://github.com/jonumhills/ripcord"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline text-sm w-fit"
          >
            github.com/jonumhills/ripcord ↗
          </a>
          <p className="text-muted text-sm">Press &amp; partnership inquiries: open an issue on the repo above.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
