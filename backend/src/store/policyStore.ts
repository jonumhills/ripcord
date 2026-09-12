import { randomBytes, createHash } from "node:crypto";
import { getPool } from "../db/pool.js";
import type { Policy, Address } from "../types.js";

/**
 * Renamed from memoryStore.ts — it stopped being in-memory. That version wrote through to a
 * local JSON file, which fixed restarts losing data locally but doesn't survive Railway: every
 * redeploy gets a fresh container with an ephemeral filesystem, wiping it the exact same way a
 * restart used to. This is the real fix — Postgres (via Supabase) survives both redeploys and
 * running more than one instance, which a local file never could.
 *
 * Run backend/supabase/schema.sql once on a fresh Supabase project before using this.
 */

/** `0x` + 32 hex chars, same shape as every address/tx hash already shown in the UI — not a
 * sequential counter, so it doesn't leak how many policies exist or make the next one guessable.
 * Hashing `Date.now()` plus 16 random bytes (instead of just returning the random bytes raw) is
 * belt-and-suspenders: even if the underlying CSPRNG were ever weak, the timestamp salt still
 * varies the output, and hashing avoids ever exposing raw randomBytes output directly as an id. */
function generatePolicyId(): string {
  const seed = `${Date.now()}-${randomBytes(16).toString("hex")}`;
  return "0x" + createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

interface PolicyRow {
  id: string;
  holder: string;
  payout_address: string;
  covered_addresses: string[];
  coverage_cap: string;
  premium_paid: string;
  start_time: Date;
  expiry: Date;
  active: boolean;
  claimed: boolean;
  on_chain_policy_id: string | null;
  bind_tx_hash: string | null;
  claimed_at: Date | null;
  claim_tx_hash: string | null;
  claim_trigger_address: string | null;
}

function fromRow(row: PolicyRow): Policy {
  return {
    id: String(row.id),
    holder: row.holder as Address,
    payoutAddress: row.payout_address as Address,
    coveredAddresses: row.covered_addresses as Address[],
    coverageCap: row.coverage_cap,
    premiumPaid: row.premium_paid,
    startTime: row.start_time.toISOString(),
    expiry: row.expiry.toISOString(),
    active: row.active,
    claimed: row.claimed,
    onChainPolicyId: row.on_chain_policy_id,
    bindTxHash: row.bind_tx_hash,
    claimedAt: row.claimed_at ? row.claimed_at.toISOString() : null,
    claimTxHash: row.claim_tx_hash,
    claimTriggerAddress: row.claim_trigger_address as Address | null,
  };
}

export async function createPolicy(policy: Omit<Policy, "id">): Promise<Policy> {
  // Store addresses lowercased, not as received (which may be checksummed/mixed-case from the
  // frontend) — Postgres's `@>` array-containment operator is a plain text comparison, case
  // sensitive by default. Confirmed live: a query for a lowercase address against a stored
  // checksummed one returned 0 rows even though it's "the same" address. Every other lookup in
  // this codebase already treats addresses as case-insensitive (scamsniffer, goldrush, etc. all
  // .toLowerCase() before comparing) — this keeps storage consistent with that instead of
  // relying on every future caller to remember to normalize both sides itself.
  const { rows } = await getPool().query<PolicyRow>(
    `insert into policies
       (id, holder, payout_address, covered_addresses, coverage_cap, premium_paid, start_time,
        expiry, active, claimed, on_chain_policy_id, bind_tx_hash, claimed_at, claim_tx_hash,
        claim_trigger_address)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     returning *`,
    [
      generatePolicyId(),
      policy.holder.toLowerCase(),
      policy.payoutAddress.toLowerCase(),
      policy.coveredAddresses.map((a) => a.toLowerCase()),
      policy.coverageCap,
      policy.premiumPaid,
      policy.startTime,
      policy.expiry,
      policy.active,
      policy.claimed,
      policy.onChainPolicyId,
      policy.bindTxHash,
      policy.claimedAt,
      policy.claimTxHash,
      policy.claimTriggerAddress,
    ]
  );
  return fromRow(rows[0]);
}

export async function getPolicy(id: string): Promise<Policy | undefined> {
  if (!/^0x[0-9a-fA-F]+$/.test(id)) return undefined; // ids are generatePolicyId()'s 0x+hex shape
  const { rows } = await getPool().query<PolicyRow>("select * from policies where id = $1", [id]);
  return rows[0] ? fromRow(rows[0]) : undefined;
}

const PATCH_COLUMN_MAP: Partial<Record<keyof Policy, string>> = {
  holder: "holder",
  payoutAddress: "payout_address",
  coveredAddresses: "covered_addresses",
  coverageCap: "coverage_cap",
  premiumPaid: "premium_paid",
  startTime: "start_time",
  expiry: "expiry",
  active: "active",
  claimed: "claimed",
  onChainPolicyId: "on_chain_policy_id",
  bindTxHash: "bind_tx_hash",
  claimedAt: "claimed_at",
  claimTxHash: "claim_tx_hash",
  claimTriggerAddress: "claim_trigger_address",
};

export async function updatePolicy(id: string, patch: Partial<Policy>): Promise<Policy | undefined> {
  const entries = Object.entries(patch).filter(([key]) => key in PATCH_COLUMN_MAP);
  if (entries.length === 0) return getPolicy(id);

  const setClauses = entries.map(([key], i) => `${PATCH_COLUMN_MAP[key as keyof Policy]} = $${i + 2}`);
  // Same lowercasing as createPolicy, applied to whichever of these three fields is actually
  // being patched — keeps storage consistent no matter which code path writes a policy.
  const values = entries.map(([key, value]) => {
    if ((key === "holder" || key === "payoutAddress") && typeof value === "string") return value.toLowerCase();
    if (key === "coveredAddresses" && Array.isArray(value)) return value.map((a) => String(a).toLowerCase());
    return value;
  });

  const { rows } = await getPool().query<PolicyRow>(
    `update policies set ${setClauses.join(", ")} where id = $1 returning *`,
    [id, ...values]
  );
  return rows[0] ? fromRow(rows[0]) : undefined;
}

export async function listActivePolicies(): Promise<Policy[]> {
  const { rows } = await getPool().query<PolicyRow>("select * from policies where active = true");
  return rows.map(fromRow);
}

/** Admin-only in practice (gated at the route level, not here) — every policy regardless of
 * active/claimed status, for the admin dashboard/testing endpoints and /api/policies/mine. */
export async function listAllPolicies(): Promise<Policy[]> {
  // Ordered by start_time, not id — id is now a hash (see generatePolicyId()), so it carries no
  // chronological meaning to sort by.
  const { rows } = await getPool().query<PolicyRow>("select * from policies order by start_time desc");
  return rows.map(fromRow);
}

/** Removes a policy from the backend's own bookkeeping so it stops being monitored and the same
 * address(es) can be rebound for another test pass. Does NOT touch the on-chain PolicyVault —
 * see admin.ts's own doc comment for why that's a real limitation, not an oversight. */
export async function deletePolicy(id: string): Promise<boolean> {
  const result = await getPool().query("delete from policies where id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

/** Wipes every policy — the bulk version of deletePolicy(), for "start fresh" testing. Returns
 * how many were removed. */
export async function deleteAllPolicies(): Promise<number> {
  const result = await getPool().query("delete from policies");
  return result.rowCount ?? 0;
}

/** All active policies that cover a given address — what the monitor checks against on every event.
 * Uses Postgres's array-contains operator (`@>`), backed by the GIN index in schema.sql. */
export async function findPoliciesCovering(address: Address): Promise<Policy[]> {
  const { rows } = await getPool().query<PolicyRow>(
    "select * from policies where active = true and covered_addresses @> array[$1]::text[]",
    [address.toLowerCase()]
  );
  return rows.map(fromRow);
}
