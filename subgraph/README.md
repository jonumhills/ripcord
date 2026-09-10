# Ripcord approvals subgraph

Indexes `Approval` events from four major mainnet ERC-20 contracts (USDC, USDT, DAI, WETH) into one entity. This is Graph Product #2 in Ripcord's pipeline — composed with the Token API (Product #1, used in `backend/src/services/graphTokenApi.ts`) to satisfy "2+ composed Graph products," and genuinely load-bearing: it's a faster, independently-sourced signal for the same "unlimited approval" risk factor `riskEngine.ts` scores on, catching a brand-new approval before GoldRush's own indexer has caught up.

## Status

| Item | Status |
|---|---|
| `graph codegen` | ✅ Verified — generates typed bindings for all 4 data sources |
| `graph build` | ✅ Verified — compiles to WASM (`build/subgraph.yaml`) |
| Deployed to Studio | ⏳ Not yet deployed — needs a Subgraph Studio account/API key |

## An honest correction this design went through

The original plan for this subgraph was different: index Transfer/Approval events for *arbitrary insured wallets* to power live drain monitoring. That doesn't actually work — a standard Subgraph's data sources are bound to specific contract addresses declared at deploy time; there's no way to have one watch "any ERC-20 event involving address X" for an arbitrary EOA across the whole chain, since insured wallets aren't contracts you control or predeploy against.

So the design split into two honest pieces instead:
- **Live drain monitoring** (arbitrary insured wallets) → polls The Graph's **Token API** per address instead — see `backend/src/monitor/walletMonitor.ts`. That's the correct tool for "arbitrary address, no fixed contract."
- **This subgraph** → indexes a *fixed, known* set of contracts (the major stablecoins/WETH), which is exactly what Subgraphs are built for, and still gives a genuinely useful, genuinely composable second signal.

## Why mainnet, not Arc

Confirmed 2026-09-09: The Graph's supported networks for both the Token API and Subgraph Studio are Ethereum mainnet, Base, Arbitrum One, and Solana. **Arc is not on that list.** That's fine — this subgraph indexes the chains where insured wallets actually have approval history; Arc is purely `PolicyVault`'s settlement chain for premiums and payouts, unrelated to where the wallet risk data comes from.

## Setup

```bash
npm install
npx graph codegen
npx graph build        # verify it compiles before deploying
```

## Deploy

```bash
npx graph auth --studio   # paste your Subgraph Studio deploy key
npm run deploy             # graph deploy --studio ripcord-approvals
```

Copy the resulting query URL into `backend/.env`'s `GRAPH_SUBGRAPH_URL`.

## Querying it

```graphql
{
  approvalEvents(where: { owner: "0x...", isUnlimited: true }, orderBy: blockTimestamp, orderDirection: desc) {
    spender
    tokenSymbol
    blockTimestamp
    transactionHash
  }
}
```

`backend/src/services/graphSubgraph.ts` wraps exactly this query and merges the result into `riskEngine.ts` alongside GoldRush's approvals.

## Extending it

Adding a fifth token is one more `dataSources` entry in `subgraph.yaml` pointing at the same `ERC20` ABI and the same `handleApproval` — no mapping changes needed, since the handler reads the token address off `event.address` rather than assuming which contract fired.
