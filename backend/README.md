# Ripcord backend

All core logic lives here: risk engine, quote engine, Arc chain client, wallet monitor, claims agent. Web and extension are thin clients — neither computes a score or a premium itself.

## Status

| Piece | Status |
|---|---|
| Server boots, `/health` responds | ✅ Verified (`npm run dev`, `curl localhost:8080/health`) |
| `npx tsc --noEmit` | ✅ Clean, 0 errors |
| `/api/risk/assess` end-to-end | ✅ **Live-tested** against a real wallet (vitalik.eth) with real API keys — real score, real reasons, ~5s response, zero errors |
| `/api/quote` end-to-end | ✅ **Live-tested** — correctly risk-priced ($62.80 premium on $1,000 coverage for a "high" tier wallet) |
| Token API integration (`graphTokenApi.ts`) | ✅ Live-verified, two real bugs fixed — see below |
| GoldRush approvals | ✅ Live-verified, one real bug fixed — see below |
| Subgraph approvals (`graphSubgraph.ts`) | ⏳ Code correct, needs `subgraph/` deployed to Studio first (falls back to GoldRush alone until then — confirmed no crash) |
| Sourcify | ✅ Live-verified, migrated to v2 (v1 is dead) — see below |
| ScamSniffer | ✅ Free, no key, works as-is |
| PolicyVault on Arc | ✅ Deployed and wired in — `0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855`, see `contracts/README.md` |
| Monitor + claims agent | Code correct and wired to the live vault; not yet triggered end-to-end (needs a real or simulated incident — see `/api/demo/simulate-incident`) |
| Postgres (Supabase) | ✅ **Live-verified** — schema applied, policy create/read/update/delete and the full sign-in flow (real signature, replay rejection) all tested against the real database, not a mock |

## Real bugs found and fixed by actually testing with live API keys (2026-09-11)

Three separate integrations were guessed at before real keys were available, and all three turned out subtly wrong in different ways once tested for real — worth knowing exactly what changed:

**Token API (`graphTokenApi.ts`):** Auth is `X-Api-Key: <key>`, not `Authorization: Bearer <key>` (Bearer gave a real 401; confirmed by testing both directly). There's no single `address` filter param — unrecognized query keys are silently accepted and ignored rather than rejected, which made the wrong param name (`address`) look like it was "working" while actually returning unfiltered global data. The real params, found by triggering the API's own Zod validation on bad values, are `from_address` and `to_address`. Also: **this API key's plan caps `limit` at 10** (a distinct 403 from the schema's general max of 1000) — confirmed live. That means "wallet age" can only honestly be a lower-bound approximation (oldest of the last 10 transfers in each direction) for any wallet with more history than that, which is most wallets. Documented directly in the function's own comment rather than presented as exact.

**GoldRush (`goldrush.ts`):** The real response is nested by *token*, not a flat list of approvals — `data.items[]` is one entry per approved token, each with its own `spenders[]` array, not a top-level `spender_address` per item. Also, `allowance` can be the literal string `"UNLIMITED"`, not just a large numeric string — checked for explicitly now.

**Sourcify (`sourcify.ts`):** The `/server/check-all-by-addresses` (v1) endpoint this used to call is dead — Sourcify's own docs: "API v1 has been completely turned off as of July 7, 2026." Migrated to v2: `GET /v2/contract/{chainId}/{address}`, 200 = verified, 404 = not. Separately, a heavily-used real wallet can have 900+ historical approval spenders — checking each one individually floods Sourcify's public instance and gets rate-limited (429, confirmed live) well before finishing. Fixed in `riskEngine.ts`: only unique spenders with an *unlimited* allowance are checked (that's the actual risk signal), capped to the 20 most recently updated.

## A design correction worth knowing about (2026-09-09)

Two things in an earlier pass here were guessed rather than verified, and both turned out wrong:

1. **The Token API's actual request shape.** Guessed as `GET /transfers/evm/{address}` on `token-api.thegraph.com`. The real thing (confirmed by following the redirect on thegraph.com's own quick-start page, and by a live 401-with-structured-JSON response once this was fixed) is `GET https://api.pinax.network/v1/evm/transfers?network=mainnet&address=0x...` — address as a query param, not a path segment, and a required `network` param. Fixed in `graphTokenApi.ts`.

2. **The live-monitoring design.** Originally planned as a custom Subgraph watching arbitrary insured wallets. That doesn't work — Subgraph data sources are bound to fixed contract addresses declared at deploy time, and insured EOAs aren't contracts you predeploy against. Fixed by having `monitor/walletMonitor.ts` poll the Token API per insured address instead (the correct tool for "arbitrary address, no fixed contract"), and repointing the actual `subgraph/` package at something a Subgraph is genuinely good for: a curated set of major mainnet ERC-20 contracts, indexing their `Approval` events as a second, faster-than-GoldRush signal. Full explanation in `subgraph/README.md`.

Also worth knowing: **Arc is not a supported network for either the Token API or Subgraph Studio** (confirmed list: Ethereum mainnet, Base, Arbitrum One, Solana). This isn't a problem — insured wallets have their real history on those chains, not Arc, which is purely where `PolicyVault` settles premiums and payouts. `GRAPH_TOKEN_API_NETWORK` and `WALLET_CHAIN_ID` control which chain risk signals are read from; both default to mainnet.

## API surface

| Route | Purpose |
|---|---|
| `POST /api/risk/assess` | `{ addresses: string[] }` → live risk score per address. Used by the extension's risk-assessor screen. |
| `POST /api/quote` | `{ addresses: string[], coverageCapUsd: number }` → premium quote (bundle + per-address). |
| `POST /api/policy/bind` | Registers a policy *after* the user's wallet has already called `PolicyVault.bindPolicy()` directly on-chain — the backend never touches premium funds. Body needs the resulting `onChainPolicyId` + `bindTxHash`. |
| `GET /api/policy/:id` | Policy status. |
| `POST /api/demo/simulate-incident` | **For the hackathon video.** Fires the exact same claims-agent code path the live monitor uses, on cue, so a payout can be triggered deterministically while recording instead of waiting on real polling latency. |
| `POST /api/auth/nonce` | `{ address }` → a one-time message to sign. No gas, no transaction. |
| `POST /api/auth/verify` | `{ address, signature }` → recovers the signer with viem's `recoverMessageAddress` (pure/offline, no RPC) and issues a session token if it matches. |
| `POST /api/auth/signout` | Invalidates the session token in `Authorization: Bearer`. |
| `GET /api/policies/mine` | **Requires sign-in.** Every policy where the caller is the holder or a covered address — powers the web app's `/dashboard`. |
| `GET /api/admin/policies` | **Testing-only.** Lists every policy regardless of status. Requires `X-Admin-Key` header. |
| `PATCH /api/admin/policy/:id` | **Testing-only.** Directly edit a policy's coverage/status without redoing a real on-chain bind — see the important caveat below. |
| `DELETE /api/admin/policy/:id` | **Testing-only.** Removes a policy from backend tracking so its address(es) can be rebound fresh. |
| `DELETE /api/admin/policies` | **Testing-only.** Wipes every policy at once — see "Persistence" below for why this is now the actual way to start fresh instead of a restart. |

### Admin routes — for testing coverage, not a real feature

`routes/admin.ts` gates `PATCH`/`DELETE`/the policy list behind a shared secret (`ADMIN_API_KEY`, sent as `X-Admin-Key`). Set it in `.env` (`openssl rand -hex 24` is fine) — every admin route 401s if it's unset, rather than falling open. This is a real insurer never letting a policyholder edit their own coverage, so don't build a UI for this; it's for resetting state between test passes without spending testnet USDC on a fresh bind every time.

**Important limitation, not a bug:** editing `coverageCap` here only changes the backend's own bookkeeping/display. The actual USDC amount `payClaim()` pays out is fixed on-chain in `PolicyVault` at bind time — there's no admin function on the contract to change it, deliberately (nothing, including the vault's owner, should be able to alter a bound policy's payout after the fact). To test a different payout amount, bind a fresh policy at that amount instead.

## The monitor + claims agent

`src/monitor/walletMonitor.ts` polls the Token API every 5s for each actively-insured address, checks new outgoing transfers against the ScamSniffer flagged list, and for any hit calls `src/agents/claimsAgent.ts`, which independently verifies the policy and calls `payClaim()` on Arc — no human in that path. If `GRAPH_TOKEN_API_KEY` isn't set yet, polling just fails quietly per-address (logged, not fatal); use `/api/demo/simulate-incident` in the meantime.

## Data sources — where each risk signal actually comes from

- **Wallet age + activity** — The Graph Token API, mainnet by default (`src/services/graphTokenApi.ts`)
- **Unlimited/stale approvals** — merged from two sources: GoldRush/Covalent's snapshot (`src/services/goldrush.ts`, broad coverage) and the `subgraph/` package's live feed for major tokens (`src/services/graphSubgraph.ts`, faster but narrower) — see `riskEngine.ts`'s `mergeApprovals`
- **Prior contact with flagged addresses** — ScamSniffer scam-database, free/no-key (`src/services/scamsniffer.ts`)
- **Contract verification of approval spenders** — Sourcify, free/no-key, checked on the wallet's home chain via `WALLET_CHAIN_ID` (`src/services/sourcify.ts`)

## Persistence — Postgres via Supabase

`src/store/policyStore.ts` and `src/services/authStore.ts` (renamed from `memoryStore.ts` — it stopped being in-memory) are backed by real Postgres, connected via `pg` using Supabase's **session pooler** (port 5432 — the one meant for a persistent long-running server like this one on Railway, as opposed to the transaction pooler on 6543 meant for serverless/edge). This replaced two earlier, weaker approaches in the same session: pure in-memory (wiped on every restart, and nearly every backend code change needs one) and a JSON file (wiped on every Railway *redeploy*, since its filesystem is ephemeral — the exact same problem one layer up).

**Setup:**
1. Create a Supabase project, grab its connection string from Project Settings → Database → Connection string → **Session pooler**.
2. Run `supabase/schema.sql` against it once — either paste it into the Supabase SQL editor, or `psql "$DATABASE_URL" -f supabase/schema.sql`.
3. Set `DATABASE_URL` in `.env` to that connection string (with your real database password, not the `[YOUR-PASSWORD]` placeholder Supabase shows before you fill it in).

Verified live end-to-end: schema applied to a real project, policy create/read/update/delete confirmed via direct SQL and the API, the full sign-in flow (real signature, nonce replay correctly rejected), and — a real bug caught in the process — addresses now stored lowercase, since Postgres's `@>` array-containment operator is case-sensitive and a checksummed (mixed-case) address from the frontend silently wouldn't have matched a lowercase query otherwise.

RLS is enabled on all three tables with no policies defined — the backend only ever connects with the database's own credentials (never an anon/public key), so this is pure defense in depth, not load-bearing for anything working.

To start fresh: `DELETE /api/admin/policies`, or truncate the tables directly in the SQL editor.

## Sign-in with wallet

Real signature verification, not "trust whatever address the frontend sends" — an address alone in a request body is spoofable. `POST /api/auth/nonce` issues a one-time message; the wallet signs it with `personal_sign` (no gas, no transaction); `POST /api/auth/verify` recovers the signing address from that signature with viem's `recoverMessageAddress` and only issues a session token if it matches the claimed address. Verified live end-to-end (`backend/test-auth.mjs`, run once and deleted — not part of the repo): real signature accepted, malformed signature rejected (400), consumed-nonce replay rejected (400), missing auth header rejected (401).

Sessions and nonces live in Postgres (`authStore.ts` — see "Persistence" above), not in-memory, so sign-in survives restarts and works correctly across more than one backend instance. One real limitation worth knowing regardless: this only verifies EOA signatures. A smart-contract wallet (Safe, etc.) would need ERC-1271 verification instead, which `recoverMessageAddress` doesn't do — out of scope here.

## Deploying to Railway

1. New Railway project → deploy from GitHub → set root directory to `backend/`.
2. Railway auto-detects `npm run build` / `npm start` from `package.json`; no Dockerfile needed.
3. Paste every var from `.env.example` into Railway's environment variables panel.
4. Set `CORS_ORIGINS` to your deployed web URL and, once you know it, `chrome-extension://<your-extension-id>`.
