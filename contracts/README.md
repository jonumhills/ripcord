# Ripcord contracts

`PolicyVault` is the entire on-chain surface of the product: it holds pooled USDC premiums, binds policies, and pays a fixed, parametric claim the instant the claims agent calls `payClaim`. No governance, no discretionary review — that's not a simplification for the hackathon, it's the actual product: Ripcord's whole pitch against Fairside/Coincover/Nexus Mutual is that detection *is* the claim, and this contract is where that promise is enforced.

## Status

| Item | Status |
|---|---|
| `PolicyVault.sol` | ✅ Compiles clean (`forge build`), 7/7 tests passing (`forge test`) |
| Reentrancy ordering | ✅ Fixed — `bindPolicy` now does all state writes before the external `transferFrom` call |
| Zero-address guards | ✅ Added on constructor and `setClaimsAgent` |
| Arc testnet connectivity | ✅ Verified live — see below |
| Deployed instance | ✅ **Live on Arc testnet**, deployed 2026-09-11 — `0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855` |

### Deployed instance

- **Address:** `0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855`
- **Explorer:** [testnet.arcscan.app/address/0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855](https://testnet.arcscan.app/address/0x4345b8Ba9288C049dB4A405EA2F2E6bf7cb89855)
- **Owner (deployer):** `0xcFdab5B40fA50A604ca01eC83693647011919B38` — a demo-only key generated for this hackathon, funded with 20 USDC from the Circle faucet. Not for production use.
- **Claims agent:** `0x3B22a9df6B5d6df3E1253769Ed5341bbd3B79002` — the only address that can call `payClaim()`. Its private key lives in `backend/.env` as `CLAIMS_AGENT_PRIVATE_KEY`.
- **Deploy cost:** ~0.05 USDC (gas on Arc is paid in USDC — see "Verified Arc testnet facts" below)
- Verified post-deploy with `cast call` against `owner()`, `claimsAgent()`, `usdc()` — all match expected values.
- `backend/.env` and `web/.env.local` already point at this address (both gitignored — not in the repo, set them yourself from `.env.example` + this address if you're pulling the repo fresh).

## Verified Arc testnet facts (2026-09-09)

Confirmed directly against the live RPC with `cast`, not copied from docs unchecked:

```
$ cast chain-id --rpc-url https://rpc.testnet.arc.network
5042002
$ cast call 0x3600000000000000000000000000000000000000 "symbol()(string)" --rpc-url https://rpc.testnet.arc.network
"USDC"
$ cast call 0x3600000000000000000000000000000000000000 "decimals()(uint8)" --rpc-url https://rpc.testnet.arc.network
6
```

- **Chain ID:** `5042002`
- **RPC:** `https://rpc.testnet.arc.network`
- **USDC:** a *predeploy* at `0x3600000000000000000000000000000000000000` — not something you deploy yourself, it's fixed network-wide. Also Arc's native gas token, so you need testnet USDC for gas *and* for premiums, from the same faucet.
- **Faucet:** [faucet.circle.com](https://faucet.circle.com) → select "Arc Testnet" (sends 10 USDC)
- **Explorer:** [testnet.arcscan.app](https://testnet.arcscan.app)

All of this is already filled into `.env.example` here, and into `backend/.env.example` / `web/.env.example` — the only blank left is `POLICY_VAULT_ADDRESS`, which appears once you deploy.

## Setup

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup   # if Foundry isn't installed yet
forge install foundry-rs/forge-std --no-git                # pulls test framework into lib/ (gitignored)
cp .env.example .env                                        # fill in PRIVATE_KEY and CLAIMS_AGENT_ADDRESS
forge build
forge test -vv
```

## Deploy to Arc testnet

1. Fund your deployer address with testnet USDC from the faucet above (covers both gas and nothing else — `bindPolicy`'s premium comes from whoever binds a policy, not the deployer).
2. Fill `.env`: `PRIVATE_KEY` (deployer), `CLAIMS_AGENT_ADDRESS` (the backend's claims-agent wallet — see `backend/.env.example`'s `CLAIMS_AGENT_PRIVATE_KEY`, this is that same wallet's public address).
3. Run:
   ```bash
   forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast -vvvv
   ```
4. Copy the printed `PolicyVault deployed at: 0x...` address into `backend/.env` (`POLICY_VAULT_ADDRESS`) and `web/.env.local` (`NEXT_PUBLIC_POLICY_VAULT_ADDRESS`).

## Tests

`test/PolicyVault.t.sol` — 7 tests, all passing, run against `src/mocks/MockUSDC.sol` (a minimal mintable ERC20 standing in for the real predeploy, since Anvil's local chain doesn't have Arc's predeploys). Covers:

- Binding pulls the exact premium and stores the policy correctly
- The claims agent can pay a claim, and only the claims agent can
- A stranger calling `payClaim` reverts
- Double-claiming reverts (via the `active` flag, checked before `claimed`)
- An expired policy can't be claimed
- Zero-address and empty-coverage inputs are rejected

```bash
forge test -vv
```

```
Ran 7 tests for test/PolicyVault.t.sol:PolicyVaultTest
[PASS] test_bindPolicy_pullsPremiumAndStoresPolicy() (gas: 314701)
[PASS] test_claimsAgent_canPayClaim_onFlaggedDrain() (gas: 382354)
[PASS] test_revert_bindPolicy_withNoCoveredAddresses() (gas: 35807)
[PASS] test_revert_constructor_withZeroAddress() (gas: 6198)
[PASS] test_revert_onDoubleClaim() (gas: 399915)
[PASS] test_revert_onExpiredPolicy() (gas: 329598)
[PASS] test_revert_whenStrangerCallsPayClaim() (gas: 326650)
Suite result: ok. 7 passed; 0 failed; 0 skipped
```

## What's deliberately not here

- No governance, no discretionary claims path, no oracle — `payClaim` is a single permissioned call from the claims agent, which is what makes "detection is the claim" literally true on-chain, not just marketing copy.
- `withdrawReserve` is a demo-only escape hatch for recovering testnet funds. Strip it (or put it behind a timelock) before any real deployment — flagged in the contract itself.
- Actuarial soundness (reserve ratios, reinsurance backstop) lives outside the contract, in how the backend prices `coverageCap` vs collected premium (see `backend/src/services/quoteEngine.ts`). The vault just enforces "pay the fixed cap once, to the right address, before expiry."
