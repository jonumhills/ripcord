# Ripcord web

Next.js 14 App Router. Two jobs in one app: the marketing site (`/`) and the full product flow (`/app`, `/bind`, `/app/policy/[id]`, `/dashboard`) — including binding, which the extension deliberately doesn't do.

## Status

`npm run build` succeeds clean across all 7 routes (2026-09-11), not just a dev-server smoke test. Two real bugs found and fixed along the way:

- `lib/chain.ts` created a viem client at module load time, which runs during SSR even on `"use client"` pages — with no `NEXT_PUBLIC_ARC_RPC_URL` set, that crashed `/app`, `/connect`, and `/bind` with a 500 before anyone clicked anything. Fixed by deferring client creation to a lazy `getPublicClient()` called only from inside event handlers.
- `/bind` uses `useSearchParams()`, which Next 14's app router requires to be wrapped in a `Suspense` boundary or the production build fails outright ("should be wrapped in a suspense boundary") — `force-dynamic` alone does not exempt it, confirmed by `next build` actually failing before the fix. Split into `BindPageInner` + a `Suspense`-wrapped default export.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000 (or the next free port if that's taken)
```

## Pages

| Route | Purpose |
|---|---|
| `/` | Marketing: hero, how it works, trust/comparison table, pricing. |
| `/app` | Add addresses → live risk assessment → quote, same as the extension but full-page. Shows a step tracker (Add → Risk → Quote). |
| `/dashboard` | **"My wallets"** — every policy tied to the signed-in address, as holder or covered address. Requires sign-in (see below); empty and loading states both designed, not just missing. |
| `/connect` | Wallet-connect handshake page the extension opens in a real tab (see `extension/README.md` for why). |
| `/bind` | Reads `?addresses=&coverageCapUsd=` from either `/app` or the extension, connects a wallet, switches it to Arc Testnet if needed, approves USDC, calls `PolicyVault.bindPolicy()` directly from the user's wallet, then registers the policy with the backend for monitoring. Shows a step tracker (Review → Connect → Sign). |
| `/app/policy/[id]` | Policy dashboard. **This is the page to have open for the hackathon video** — it has the "Simulate incident" panel that fires the real claims-agent payout path on cue. |

## Sign-in with wallet

`Nav`'s "Sign in" button (and `/dashboard`'s own prompt) call `lib/auth.ts`'s `signInWithMetaMask()`: connect (forcing the account picker — see the wallet-connect note below), fetch a one-time challenge from the backend, sign it with `personal_sign` (no gas, no transaction), send the signature back for verification, store the resulting session token in `localStorage`. `lib/useAuth.ts` is the shared hook `Nav` and `/dashboard` both read so sign-in/out in one doesn't leave the other stale.

## Two wallet-interaction bugs fixed live (2026-09-11)

Both hit during actual testing, not found by review:

- **"Every time I click connect wallet, it's picking the previous wallet address only."** `eth_requestAccounts` alone doesn't show MetaMask's picker once a site is already authorized — it silently returns the same account forever. Fixed in `lib/chain.ts`'s `connectWallet()` (and reused by `lib/auth.ts`'s sign-in) by calling `wallet_requestPermissions` for `eth_accounts` first, which forces the picker open again.
- **"current chain of the wallet (id: 10) does not match target chain (5042002 - Arc Testnet)."** Nothing asked the wallet to switch networks before signing. Added `ensureArcChain()`: `wallet_switchEthereumChain`, falling back to `wallet_addEthereumChain` (error code 4902) if the wallet doesn't know about Arc Testnet yet. Called both right after connecting on `/bind` and again immediately before the approve/bind writes.

## Design system notes

Tokens (colors, fonts) live in `app/globals.css`, lifted from canivibecodeit.com — see the root README. A few reusable primitives were added during the UI pass: `.steps`/`.step`/`.step-dot` (the progress trackers on `/app` and `/bind`), `.risk-meter`/`.risk-meter-fill` (the 0–100 bar on `RiskCard`), `.card-accent` (success/highlight state — e.g. the "claim paid" banner), and `.fade-in-up` (a cheap entrance animation for sections that appear after an action, so they don't just snap into existence). One thing worth knowing if you add more: `.card` + a Tailwind `border-{color}` utility does **not** reliably override the card's own border — both have equal CSS specificity and `.card`'s plain `border:` rule is written later in the stylesheet than Tailwind's utilities layer, so it wins the cascade regardless of which one you'd expect. Use a dedicated class (like `.card-accent`) instead of trying to override `.card` with a utility class.

## Deploying to Vercel

1. New Vercel project → import from GitHub → set root directory to `web/`.
2. Framework preset: Next.js (auto-detected).
3. Paste every var from `.env.example` into Vercel's environment variables.
4. Once deployed, update `extension/manifest.config.ts`'s `externally_connectable` to your real Vercel URL, and rebuild the extension.
