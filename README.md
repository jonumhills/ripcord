# Ripcord

Parametric wallet insurance. Add an address, get a live risk score, get a quote, bind a policy, get paid automatically the moment an insured wallet is drained to a known-bad address — no claims form, no DAO vote.

## Status (updated 2026-09-09)

Built for ETHGlobal Online. Everything below has actually been run, not just written — see each subfolder's README for the exact commands and output.

| Piece | Status |
|---|---|
| `contracts/` | ✅ Compiles clean, **7/7 tests passing**, **deployed live on Arc testnet** — see below |
| `subgraph/` | ✅ `codegen` + `build` verified — compiles to deployable WASM. Not yet deployed to Studio. |
| `backend/` | ✅ **Full pipeline live-tested end-to-end** — real risk score + real quote against a real wallet, real API keys, wired to the deployed vault. Three real integration bugs found and fixed along the way; see `backend/README.md` |
| `web/` | ✅ `npm run build` succeeds clean across all 7 routes (added `/dashboard`, sign-in) — several real bugs found and fixed along the way (SSR crash, missing Suspense boundary, wallet always reusing the old account, missing Arc chain switch), see `web/README.md` |
| `extension/` | Scaffolded, not yet run through `npm install`/build — do that next |
| Vercel / Railway | ⏳ Not yet deployed — everything above is verified locally |

### PolicyVault is live

Deployed to Arc testnet 2026-09-11: **`0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855`** — [view on Arcscan](https://testnet.arcscan.app/address/0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855). Full deploy details (owner, claims agent, cost, post-deploy verification) in `contracts/README.md`. `backend/.env` and `web/.env.local` are already pointed at it locally — both gitignored, so re-set them from `.env.example` + this address if you're cloning fresh.

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
- **Arc** — `PolicyVault.sol` lives here: premiums pool here at bind time, claims pay out here via the autonomous claims agent. Testnet is enough to demo; mainnet deploy is a stretch goal only.
- **Hedera** — not in the core path. Optional stretch: log claim evidence hashes to HCS as an audit trail. Skip it if it doesn't fit by the time you're polishing.

## Getting started

Each subfolder has its own README with setup + env vars, and a Status table showing exactly what's been verified. Order to bring up locally: `contracts` (deploy to Arc testnet, get the PolicyVault address) → `subgraph` (deploy to Studio, get the query URL) → `backend` (point at both + your API keys) → `extension` / `web` (point at the backend URL).

## Design system

Visual language is lifted from [canivibecodeit.com](https://canivibecodeit.com/) — dark-first, terminal/dev-tool aesthetic, Space Grotesk for display type, JetBrains Mono for body/data, a vivid green primary accent, amber/red for warning and danger states. Tokens are defined once per app (`web/app/globals.css`, `extension/src/styles/tokens.css`) since there's no shared build step — keep them in sync by hand if you tweak one.
