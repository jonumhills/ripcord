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
| `GET /api/admin/policies` | **Testing-only.** Lists every policy regardless of status. Requires `X-Admin-Key` header. |
| `PATCH /api/admin/policy/:id` | **Testing-only.** Directly edit a policy's coverage/status without redoing a real on-chain bind — see the important caveat below. |
| `DELETE /api/admin/policy/:id` | **Testing-only.** Removes a policy from backend tracking so its address(es) can be rebound fresh. |

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

## Deploying to Railway

1. New Railway project → deploy from GitHub → set root directory to `backend/`.
2. Railway auto-detects `npm run build` / `npm start` from `package.json`; no Dockerfile needed.
3. Paste every var from `.env.example` into Railway's environment variables panel.
4. Set `CORS_ORIGINS` to your deployed web URL and, once you know it, `chrome-extension://<your-extension-id>`.
