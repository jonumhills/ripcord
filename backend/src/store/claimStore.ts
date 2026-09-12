import { getPool } from "../db/pool.js";
import type { Address, Claim, ClaimCheck, ClaimStatus } from "../types.js";

interface ClaimRow {
  id: number;
  policy_id: number;
  submitted_tx_hash: string;
  status: ClaimStatus;
  from_address: string | null;
  trigger_address: string | null;
  token_address: string | null;
  amount: string | null;
  verdict: "approved" | "denied" | null;
  reasoning: string | null;
  checks: ClaimCheck[] | null;
  payout_tx_hash: string | null;
  failure_reason: string | null;
  submitted_at: Date;
  reviewed_at: Date | null;
  paid_at: Date | null;
}

function fromRow(row: ClaimRow): Claim {
  return {
    id: String(row.id),
    policyId: String(row.policy_id),
    submittedTxHash: row.submitted_tx_hash,
    status: row.status,
    fromAddress: row.from_address as Address | null,
    triggerAddress: row.trigger_address as Address | null,
    tokenAddress: row.token_address as Address | null,
    amount: row.amount,
    verdict: row.verdict,
    reasoning: row.reasoning,
    checks: row.checks,
    payoutTxHash: row.payout_tx_hash,
    failureReason: row.failure_reason,
    submittedAt: row.submitted_at.toISOString(),
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
  };
}

export async function createClaim(policyId: string, submittedTxHash: string): Promise<Claim> {
  const { rows } = await getPool().query<ClaimRow>(
    `insert into claims (policy_id, submitted_tx_hash, status) values ($1, $2, 'pending') returning *`,
    [policyId, submittedTxHash]
  );
  return fromRow(rows[0]);
}

export async function getClaim(id: string): Promise<Claim | undefined> {
  if (!/^\d+$/.test(id)) return undefined;
  const { rows } = await getPool().query<ClaimRow>("select * from claims where id = $1", [id]);
  return rows[0] ? fromRow(rows[0]) : undefined;
}

export async function listClaimsForPolicy(policyId: string): Promise<Claim[]> {
  const { rows } = await getPool().query<ClaimRow>(
    "select * from claims where policy_id = $1 order by submitted_at desc",
    [policyId]
  );
  return rows.map(fromRow);
}

export interface ClaimUpdate {
  status?: ClaimStatus;
  fromAddress?: Address | null;
  triggerAddress?: Address | null;
  tokenAddress?: Address | null;
  amount?: string | null;
  verdict?: "approved" | "denied" | null;
  reasoning?: string | null;
  checks?: ClaimCheck[] | null;
  payoutTxHash?: string | null;
  failureReason?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
}

const UPDATE_COLUMN_MAP: Record<keyof ClaimUpdate, string> = {
  status: "status",
  fromAddress: "from_address",
  triggerAddress: "trigger_address",
  tokenAddress: "token_address",
  amount: "amount",
  verdict: "verdict",
  reasoning: "reasoning",
  checks: "checks",
  payoutTxHash: "payout_tx_hash",
  failureReason: "failure_reason",
  reviewedAt: "reviewed_at",
  paidAt: "paid_at",
};

export async function updateClaim(id: string, patch: ClaimUpdate): Promise<Claim | undefined> {
  const entries = Object.entries(patch).filter(([key]) => key in UPDATE_COLUMN_MAP);
  if (entries.length === 0) return getClaim(id);

  const setClauses = entries.map(([key], i) => `${UPDATE_COLUMN_MAP[key as keyof ClaimUpdate]} = $${i + 2}`);
  const values = entries.map(([key, value]) => {
    // jsonb column needs the array serialized, not passed as a JS object to the driver
    if (key === "checks" && value != null) return JSON.stringify(value);
    return value;
  });

  const { rows } = await getPool().query<ClaimRow>(
    `update claims set ${setClauses.join(", ")} where id = $1 returning *`,
    [id, ...values]
  );
  return rows[0] ? fromRow(rows[0]) : undefined;
}
