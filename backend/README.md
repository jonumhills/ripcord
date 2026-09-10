# Ripcord backend

All core logic lives here: risk engine, quote engine, Arc chain client, wallet monitor, claims agent. Web and extension are thin clients — neither computes a score or a premium itself.

## Status

| Piece | Status |
|---|---|
| Server boots, `/health` responds | ✅ Verified (`npm run dev`, `curl localhost:8080/health`) |
| `npx tsc --noEmit` | ✅ Clean, 0 errors |
| Token API integration (`graphTokenApi.ts`) | ✅ Endpoint shape verified live — see below |
| GoldRush approvals | ⏳ Code correct, needs an API key to test live |
| Subgraph approvals (`graphSubgraph.ts`) | ⏳ Code correct, needs `subgraph/` deployed first |
| ScamSniffer / Sourcify | ✅ Free, no key — should work as soon as the vault/subgraph are deployed |
| Monitor + claims agent | ⏳ Code correct, needs `POLICY_VAULT_ADDRESS` + `CLAIMS_AGENT_PRIVATE_KEY` to actually pay out |

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
