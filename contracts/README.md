# Ripcord contracts

`PolicyVault` is the entire on-chain surface of the product: it holds pooled USDC premiums, binds policies, and pays a fixed, parametric claim the instant the claims agent calls `payClaim`. No governance, no discretionary review — that's not a simplification for the hackathon, it's the actual product: Ripcord's whole pitch against Fairside/Coincover/Nexus Mutual is that detection *is* the claim, and this contract is where that promise is enforced.

## Status

| Item | Status |
|---|---|
| `PolicyVault.sol` | ✅ Compiles clean (`forge build`), 10/10 tests passing (`forge test`) |
| `MockDrainer.sol` | ✅ Deployed to Arc testnet, full bind→drain→claim loop verified live end-to-end (real transactions, not mocked) |
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

## MockDrainer — the hackathon demo's "scam transaction"

`src/mocks/MockDrainer.sol` reproduces the actual mechanics of a wallet-drainer phishing site — approve a spending cap, get pulled via `transferFrom` — rather than faking the drain some other way. Deployed on Arc testnet: **`0xF4038CdC67ED8cb8e059F719345336bcD808F201`**. `drain(token, victim)` is deliberately permissionless (anyone can call it once a victim has approved it) — a real drainer bot does the same thing, it doesn't wait for permission either. See `web/app/demo/scam-airdrop/page.tsx` for the page that drives this, and root `README.md` for the full demo shot list.

Real bug caught by its own test before this ever touched Arc testnet: when an approval is "unlimited" (`type(uint256).max`), the contract initially tried to literally transfer that number instead of the victim's actual balance, and reverted with "insufficient balance." Fixed to pull `min(allowance, balance)` — the same distinction a real drainer's bot has to get right.

## Operational gotcha that will silently break claim payouts

**The claims agent wallet needs its own USDC for gas** — separate from `PolicyVault`'s pooled premiums. `payClaim()` is submitted *by* the claims agent (`CLAIMS_AGENT_PRIVATE_KEY` in `backend/.env`), and since USDC is Arc's native gas token, that wallet needs a small USDC balance just to pay for its own transaction — the vault having plenty to pay *out* doesn't help if the agent can't afford to *call* `payClaim` in the first place. Hit this live: the first real claim attempt failed with "insufficient funds for gas," not because anything was misconfigured, but because the claims agent wallet had never been funded at all. Fixed by sending it 0.1 USDC (pure gas money — each `payClaim` call costs a small fraction of a cent). If claims start silently failing after a fresh deploy, check this first:

```bash
cast call 0x3600000000000000000000000000000000000000 "balanceOf(address)(uint256)" <claims-agent-address> --rpc-url https://rpc.testnet.arc.network
```

## What's deliberately not here

- No governance, no discretionary claims path, no oracle — `payClaim` is a single permissioned call from the claims agent, which is what makes "detection is the claim" literally true on-chain, not just marketing copy.
- `withdrawReserve` is a demo-only escape hatch for recovering testnet funds. Strip it (or put it behind a timelock) before any real deployment — flagged in the contract itself.
- Actuarial soundness (reserve ratios, reinsurance backstop) lives outside the contract, in how the backend prices `coverageCap` vs collected premium (see `backend/src/services/quoteEngine.ts`). The vault just enforces "pay the fixed cap once, to the right address, before expiry."
