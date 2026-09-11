import Link from "next/link";
import type { Policy } from "@/lib/types";

const USDC_DECIMALS = 6;
function formatUsdc(raw: string) {
  return (Number(raw) / 10 ** USDC_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function statusOf(policy: Policy): { label: string; className: string } {
  if (policy.claimed) return { label: "Claim paid", className: "badge-low" };
  if (!policy.active) return { label: "Expired", className: "badge-declined" };
  const daysLeft = Math.ceil((new Date(policy.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 30) return { label: `Renews in ${daysLeft}d`, className: "badge-medium" };
  return { label: "Active", className: "badge-low" };
}

export function PolicyCard({ policy }: { policy: Policy }) {
  const status = statusOf(policy);

  return (
    <Link
      href={`/app/policy/${policy.id}`}
      className="card flex flex-col gap-4 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="label-caps">
            {policy.coveredAddresses.length > 1 ? `${policy.coveredAddresses.length} addresses` : "Address"}
          </span>
          <span className="font-mono text-sm truncate">
            {policy.coveredAddresses[0]}
            {policy.coveredAddresses.length > 1 && (
              <span className="text-muted"> +{policy.coveredAddresses.length - 1} more</span>
            )}
          </span>
        </div>
        <span className={`badge ${status.className} shrink-0`}>{status.label}</span>
      </div>

      <div className="h-px bg-border" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="label-caps">Coverage</span>
          <p className="font-display text-lg mt-0.5">${formatUsdc(policy.coverageCap)}</p>
        </div>
        <div>
          <span className="label-caps">Premium paid</span>
          <p className="font-display text-lg mt-0.5">${formatUsdc(policy.premiumPaid)}</p>
        </div>
      </div>

      <span className="text-xs text-muted">Policy #{policy.id} · expires {new Date(policy.expiry).toLocaleDateString()}</span>
    </Link>
  );
}
