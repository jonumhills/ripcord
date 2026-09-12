import Link from "next/link";
import type { Policy } from "@/lib/types";

const USDC_DECIMALS = 6;
const EXPLORER_TX_BASE = "https://testnet.arcscan.app/tx/";

function formatUsdc(raw: string) {
  return (Number(raw) / 10 ** USDC_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function shortAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function shortHash(h: string) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

/** A paid claim — distinct from an active policy card. Shows the actual payout record: amount,
 * when, what triggered it, and the on-chain tx — the things "claimed: true" alone doesn't tell you. */
export function ClaimCard({ policy }: { policy: Policy }) {
  return (
    <div className="card card-accent flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="label-caps text-primary">Claim paid</span>
          <p className="font-display text-2xl text-primary mt-1">${formatUsdc(policy.coverageCap)} USDC</p>
        </div>
        {policy.claimedAt && (
          <span className="text-xs text-muted shrink-0">{new Date(policy.claimedAt).toLocaleString()}</span>
        )}
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="label-caps shrink-0">Insured wallet</span>
          <span className="font-mono">{shortAddress(policy.coveredAddresses[0] ?? "")}</span>
        </div>
        {policy.claimTriggerAddress && (
          <div className="flex items-center justify-between gap-3">
            <span className="label-caps shrink-0">Flagged destination</span>
            <span className="font-mono text-no-bg">{shortAddress(policy.claimTriggerAddress)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="label-caps shrink-0">Payout tx</span>
          {policy.claimTxHash ? (
            <a
              href={`${EXPLORER_TX_BASE}${policy.claimTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-primary hover:underline"
            >
              {shortHash(policy.claimTxHash)} ↗
            </a>
          ) : (
            <span className="text-muted">—</span>
          )}
        </div>
      </div>

      <Link href={`/app/policy/${policy.id}`} className="text-xs text-muted hover:text-fg transition-colors">
        View policy #{shortHash(policy.id)} →
      </Link>
    </div>
  );
}
