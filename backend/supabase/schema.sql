-- Ripcord backend schema. Run this once in the Supabase SQL editor (or `supabase db push`
-- if you're using the CLI) on a fresh project before pointing the backend at it.
--
-- Replaces:
--   - src/store/memoryStore.ts's JSON-file-backed Map (Railway's filesystem is ephemeral —
--     every redeploy wipes it; a Railway Volume would fix that alone, but sessions below still
--     need a real store regardless)
--   - src/services/authStore.ts's pure in-memory nonce/session Maps (reset on every restart,
--     and break entirely across more than one backend instance)

create table if not exists policies (
  -- A hash, not a counter — generated in app code (policyStore.ts's generatePolicyId()), same
  -- '0x' + hex format as every address and tx hash already shown in the UI. A sequential integer
  -- leaks how many policies exist and makes the next one guessable; nothing about this needs to
  -- be sequential, so it isn't.
  id text primary key,
  holder text not null,
  payout_address text not null,
  covered_addresses text[] not null,
  coverage_cap text not null,       -- USDC units as a string — kept as text to avoid float
  premium_paid text not null,       -- precision issues, same convention the app already uses
  start_time timestamptz not null default now(),
  expiry timestamptz not null,
  active boolean not null default true,
  claimed boolean not null default false,
  on_chain_policy_id text,
  bind_tx_hash text,
  claimed_at timestamptz,
  claim_tx_hash text,
  claim_trigger_address text
);

-- The monitor's findPoliciesCovering() and the dashboard's /api/policies/mine both filter by
-- address — covered_addresses is queried with the `@>` "contains" operator, which a GIN index
-- speeds up significantly once there's more than a handful of rows.
create index if not exists policies_covered_addresses_idx on policies using gin (covered_addresses);
create index if not exists policies_holder_idx on policies (holder);
create index if not exists policies_active_idx on policies (active) where active = true;

-- A claim is its own record, separate from the policy's own claimed/claimedAt/claimTxHash
-- summary fields (kept as-is so the dashboard/policy-detail UI built against them keeps working
-- unchanged) — this is the detailed, auditable history: every submission, what the adjuster
-- checked, its reasoning, and how the payout went, including denied and failed attempts a bare
-- "claimed: true" boolean could never represent.
create table if not exists claims (
  id bigserial primary key,
  policy_id text not null references policies(id) on delete cascade,
  submitted_tx_hash text not null,
  status text not null default 'pending',
    -- pending -> approved|denied ; approved -> paying -> paid|failed
  from_address text,
  trigger_address text,
  token_address text,
  amount text,
  verdict text,               -- 'approved' | 'denied', set once the adjuster finishes
  reasoning text,              -- the adjuster's assembled, human-readable explanation
  checks jsonb,                 -- ordered list of {label, passed, detail} the adjuster ran
  payout_tx_hash text,
  failure_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz
);
create index if not exists claims_policy_id_idx on claims (policy_id);
create index if not exists claims_status_idx on claims (status);

create table if not exists auth_nonces (
  address text primary key,
  message text not null,
  expires_at timestamptz not null
);

create table if not exists auth_sessions (
  token text primary key,
  address text not null,
  expires_at timestamptz not null
);
create index if not exists auth_sessions_address_idx on auth_sessions (address);

-- Defense in depth: the backend only ever talks to these tables with the service role key,
-- which bypasses RLS regardless — but enabling RLS with no policies defined means even a leaked
-- anon/public key can't read or write anything here. Costs nothing, breaks nothing.
alter table policies enable row level security;
alter table claims enable row level security;
alter table auth_nonces enable row level security;
alter table auth_sessions enable row level security;
