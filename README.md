# Ripcord

Parametric wallet insurance. Add an address, get a live risk score, get a quote, bind a policy. Submit a claim by pasting the transaction hash of the drain — an automated adjuster reads it directly from Arc, decides in seconds, and shows its reasoning. No human review, no DAO vote, no days-long wait.

## Status (updated 2026-09-09)

Built for ETHGlobal Online. Everything below has actually been run, not just written — see each subfolder's README for the exact commands and output.

| Piece | Status |
|---|---|
| `contracts/` | ✅ Compiles clean, **10/10 tests passing**, **deployed live on Arc testnet** — see below |
| `subgraph/` | ✅ `codegen` + `build` verified — compiles to deployable WASM. Not yet deployed to Studio. |
| `backend/` | ✅ **Full pipeline live-tested end-to-end** — real risk score + real quote against a real wallet, real API keys, wired to the deployed vault, backed by real Postgres (Supabase). Several real bugs found and fixed along the way; see `backend/README.md` |
| `web/` | ✅ `npm run build` succeeds clean across all 7 routes (added `/dashboard`, sign-in) — several real bugs found and fixed along the way (SSR crash, missing Suspense boundary, wallet always reusing the old account, missing Arc chain switch), see `web/README.md` |
| `extension/` | ✅ `npm install`, typecheck, and `npm run build` all verified clean — real icon assets generated (the build genuinely fails without them) |
| Vercel / Railway | ⏳ Not yet deployed — everything above is verified locally |

### PolicyVault is live

Deployed to Arc testnet 2026-09-11: **`0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855`** — [view on Arcscan](https://testnet.arcscan.app/address/0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855). Full deploy details (owner, claims agent, cost, post-deploy verification) in `contracts/README.md`. `backend/.env` and `web/.env.local` are already pointed at it locally — both gitignored, so re-set them from `.env.example` + this address if you're cloning fresh.

## The hackathon demo — shot list

Verified this entire sequence live end-to-end on Arc testnet (2026-09-12) using a test wallet standing in for a real user — real transactions throughout, nothing simulated. `contracts/README.md` and `backend/README.md` have the full technical writeups, including two real bugs the verification runs caught: the claims agent wallet needs its own USDC for gas separate from the vault's pooled premiums, and the adjuster initially mis-parsed a sentinel log Arc emits alongside every real USDC transfer.

1. **Bind a policy.** `/app` → add the wallet you'll drain on camera → check risk → get a quote → `/bind` → pay the premium. Land on the "Policy bound" confirmation.
2. **Cut to `/demo/scam-airdrop`.** A staged, clearly-labeled "claim your airdrop" lure — this is the one page in the whole app that's deliberately *not* styled like Ripcord, on purpose, to sell the phishing-site narrative. Click "Connect Wallet & Claim."
3. **Sign the approval.** This is the real "scam transaction" moment — MetaMask's spending-cap prompt, identical in kind to what an actual phishing site shows. Approves `MockDrainer.sol` for a small, real amount of testnet USDC.
4. **Watch the drain happen.** The page automatically calls `MockDrainer.drain()` right after — a second real transaction, pulling exactly what was approved via `transferFrom`.
5. **File the claim.** The policy ID and the real drain transaction ID are already filled in — click "Submit claim for review." This is the moment to linger on: the adjuster's full checklist appears (policy checks, transaction lookup, sender match, destination match), followed by its reasoning, assembled from what it actually found on-chain — not a canned response.
6. **Watch it pay.** Verdict flips to "Approved," the payout fires immediately, and the real transaction hash appears — a `Transfer` event of the exact coverage amount from `PolicyVault` to the payout address, confirmed on Arcscan.
7. **Cut to `/dashboard`.** The policy now shows under the **Claims** tab with the real payout record — amount, timestamp, what triggered it, tx hash.

The whole loop — sign a scam approval, get drained, file a claim, watch an automated adjuster verify and pay it — fits comfortably inside a 3-4 minute recording, and step 5 is the part worth not rushing through: it's the whole pitch, happening on screen.

## Repo layout

One repo, five independently-deployable pieces. Each folder is self-contained (own `package.json` / build) so Vercel, Railway, and GitHub can each point at just the subfolder they need — no monorepo tooling, no shared build step.

```
ripcord/
  web/         Next.js marketing site + full product flow (connect, risk dashboard, quote, bind)   -> Vercel
  extension/   Browser extension (Manifest V3): risk assessor, quote, wallet onboarding only        -> zip + Chrome Web Store / load unpacked for demo
  backend/     All core logic: risk engine, quote engine, monitoring, claims agent                  -> Railway
  contracts/   PolicyVault.sol + deploy scripts, targeting Arc testnet                               -> Foundry, deployed manually
  subgraph/    Indexes Approval events for a curated set of major mainnet tokens                     -> Subgraph Studio, deployed manually
```

**Everything that matters lives in `backend/`.** Web and extension are thin clients that call the backend's API — neither one computes a risk score or a premium itself. That's deliberate: one place to fix bugs, one place to demo, one place judges can point at and say "that's the real logic."

## How the pieces talk to each other

```
 ┌────────────┐        ┌──────────────┐        ┌───────────────────┐
 │  extension │──HTTP──▶│              │        │                    │
 │ (risk/quote/│        │   backend    │──viem──▶│  PolicyVault.sol   │
 │  onboard)   │        │  (Railway)   │        │  (Arc testnet)     │
 └────────────┘        │              │        └───────────────────┘
 ┌────────────┐        │  risk engine │
 │    web     │──HTTP──▶│  quote engine│──poll──▶ Graph Token API (mainnet)
 │ (marketing  │        │  monitor +   │          — wallet age, activity,
 │  + full app)│        │  claims agent│            live drain monitoring
 └────────────┘        └──────┬───────┘
                               ├─ subgraph/ (Graph, mainnet) — approvals feed
                               ├─ GoldRush (approvals, broad coverage)
                               ├─ ScamSniffer (flagged addresses)
                               └─ Sourcify (contract verification)
```

Note the two Graph products both run on **mainnet**, not Arc — Arc isn't a supported network for the Token API or Subgraph Studio (confirmed 2026-09-09; supported list is Ethereum, Base, Arbitrum One, Solana). That's not a gap: insured wallets have their real risk history on the chains they're actually active on, and Arc's job is purely settlement — see "Where each sponsor fits" below.

## Where each sponsor fits (only where it's the right tool)

- **The Graph** — two composed products, both load-bearing. (1) The Token API reads wallet age/activity for the risk engine, and doubles as the live-monitoring feed the claims agent watches (polling per insured address — a custom Subgraph can't watch arbitrary EOAs, since data sources are bound to fixed contract addresses). (2) `subgraph/` indexes `Approval` events from a curated set of major mainnet tokens (USDC/USDT/DAI/WETH) as a faster, independent second signal for the same "unlimited approval" risk factor. Full story on the design correction in `subgraph/README.md`.
- **Arc** — see "How Circle is used" below.
- **Hedera** — not in the core path. Optional stretch: log claim evidence hashes to HCS as an audit trail. Skip it if it doesn't fit by the time you're polishing.

## How Circle is used — Best DeFi/Onchain Finance Application

Written against the track's own language, honestly — what's actually built, not aspirational.

- **Arc is the entire settlement layer.** `PolicyVault.sol` is deployed and live on Arc testnet (`0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855`) — every premium and every payout happens there, nowhere else.
- **USDC is the only currency in the system.** Not "supported" alongside other tokens — premiums, the pooled reserve, and payouts are exclusively USDC, including gas itself (Arc's native gas token *is* USDC).
- **Conditional payments, not plain transfers.** `payClaim()` only executes if a policy is active, unclaimed, and unexpired, *and* the caller is the authorized claims agent — a real on-chain gate, not a bare `transfer`.
- **Multi-step settlement.** A claim goes through independent on-chain verification (the adjuster re-reads the actual transaction from Arc), a conditional approval, and only then final settlement — see "The claims process" in `backend/README.md`.
- **Treasury/reserve mechanics.** `PolicyVault` is a pooled USDC reserve, not a per-policy escrow — every premium ever collected sits in one contract, every claim draws from that same shared balance. That's a real treasury-management problem (reserve ratio vs. outstanding coverage), not just a payments pipe.

**Circle's core product checklist — current state, not overclaimed:**

| Product | Status |
|---|---|
| Arc | ✅ Deployed and live |
| USDC | ✅ The only currency used, including for gas |
| App Kits | ⏳ Not yet — Circle's Swap SDK (StableFX-based) has a confirmed working Arc reference (`circlefin/arc-stablecoin-fx`) |
| Circle Wallets | ⏳ Not yet — the claims agent currently uses a raw private key; a Developer-Controlled Wallet is the natural fit (it's literally built for "triggering payouts... with full control over timing, amounts, and auditability") |
| Circle Contracts (Smart Contract Platform) | ❌ Doesn't currently list Arc as a supported chain (Avalanche/Ethereum/Polygon only) |
| CCTP | ⏳ Not yet — confirmed live on Arc testnet as a native interoperability primitive, with known deployed addresses (TokenMessengerV2, MessageTransmitterV2) |
| Gateway | ⏳ Not yet — also confirmed live on Arc testnet |
| StableFX | ⏳ Not yet — same Arc-confirmed Swap SDK reference as App Kits above |

## Getting started

Each subfolder has its own README with setup + env vars, and a Status table showing exactly what's been verified. Order to bring up locally: `contracts` (deploy to Arc testnet, get the PolicyVault address) → `subgraph` (deploy to Studio, get the query URL) → `backend` (point at both + your API keys) → `extension` / `web` (point at the backend URL).

## Design system

Visual language is lifted from [canivibecodeit.com](https://canivibecodeit.com/) — dark-first, terminal/dev-tool aesthetic, Space Grotesk for display type, JetBrains Mono for body/data, a vivid green primary accent, amber/red for warning and danger states. Tokens are defined once per app (`web/app/globals.css`, `extension/src/styles/tokens.css`) since there's no shared build step — keep them in sync by hand if you tweak one.
