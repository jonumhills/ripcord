# Ripcord web

Next.js 14 App Router. Two jobs in one app: the marketing site (`/`) and the full product flow (`/app`, `/bind`, `/app/policy/[id]`) — including binding, which the extension deliberately doesn't do.

## Status

`npm install` + all four routes (`/`, `/app`, `/connect`, `/bind`) verified returning 200 (2026-09-09). One real bug found and fixed along the way: `lib/chain.ts` created a viem client at module load time, which runs during SSR even on `"use client"` pages — with no `NEXT_PUBLIC_ARC_RPC_URL` set, that crashed `/app`, `/connect`, and `/bind` with a 500 before anyone clicked anything. Fixed by deferring client creation to a lazy `getPublicClient()` called only from inside event handlers, which only ever run in the browser.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000
```

## Pages

| Route | Purpose |
|---|---|
| `/` | Marketing: hero, how it works, trust/comparison table, pricing. |
| `/app` | Add addresses → live risk assessment → quote, same as the extension but full-page. |
| `/connect` | Wallet-connect handshake page the extension opens in a real tab (see `extension/README.md` for why). |
| `/bind` | Reads `?addresses=&coverageCapUsd=` from either `/app` or the extension, connects a wallet, approves USDC, calls `PolicyVault.bindPolicy()` directly from the user's wallet, then registers the policy with the backend for monitoring. |
| `/app/policy/[id]` | Policy dashboard. **This is the page to have open for the hackathon video** — it has the "Simulate incident" panel that fires the real claims-agent payout path on cue. |

## Deploying to Vercel

1. New Vercel project → import from GitHub → set root directory to `web/`.
2. Framework preset: Next.js (auto-detected).
3. Paste every var from `.env.example` into Vercel's environment variables.
4. Once deployed, update `extension/manifest.config.ts`'s `externally_connectable` to your real Vercel URL, and rebuild the extension.
