"use client";

import { createWalletClient, createPublicClient, custom, http, type Chain } from "viem";
import { policyVaultAbi, erc20Abi } from "./abi";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? 0);
const RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "";
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS ?? "0x0") as `0x${string}`;
export const POLICY_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_POLICY_VAULT_ADDRESS ?? "0x0") as `0x${string}`;
const USDC_DECIMALS = 6;

const arcTestnet: Chain = {
  id: CHAIN_ID || 0,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export async function connectWallet(): Promise<`0x${string}`> {
  if (!hasInjectedWallet()) throw new Error("No injected wallet found — install MetaMask");

  // eth_requestAccounts alone does NOT show a picker if the site is already authorized — it
  // silently returns whatever account was connected last time, permanently, with no way to
  // choose a different one short of disconnecting the site in MetaMask's own settings. Confirmed
  // live: "every time I click connect wallet, it's picking the previous wallet address only."
  // wallet_requestPermissions for eth_accounts forces MetaMask's connection UI open again, where
  // the user can actually switch which account(s) are shared, before eth_requestAccounts resolves.
  try {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Some wallets (or a user dismissing the permissions prompt) don't support this — fall
    // through to eth_requestAccounts below rather than blocking connect entirely on it.
  }

  const [address] = (await window.ethereum.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
  return address;
}

const ARC_CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;

/** Switches the injected wallet to Arc Testnet, adding it first if the wallet doesn't know about
 * it yet. Without this, writeContract calls fail with a chain-mismatch error the moment a user's
 * wallet is on any other network — confirmed live (wallet was on Optimism, id 10, needed 5042002). */
export async function ensureArcChain(): Promise<void> {
  if (!hasInjectedWallet()) throw new Error("No injected wallet found");

  const currentChainIdHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
  if (currentChainIdHex.toLowerCase() === ARC_CHAIN_ID_HEX.toLowerCase()) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_ID_HEX }],
    });
  } catch (err: any) {
    // 4902 = chain not added to the wallet yet — add it, then the switch above will work next try.
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARC_CHAIN_ID_HEX,
            chainName: "Arc Testnet",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: ["https://testnet.arcscan.app"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export function getWalletClient() {
  if (!hasInjectedWallet()) throw new Error("No injected wallet found");
  return createWalletClient({ chain: arcTestnet, transport: custom(window.ethereum) });
}

// Lazy singleton, NOT created at module scope: "use client" files still get evaluated during
// SSR for the initial HTML, so a module-level createPublicClient(http(RPC_URL)) throws
// viem's UrlRequiredError on every page render whenever NEXT_PUBLIC_ARC_RPC_URL is unset —
// which crashed /app, /bind and /connect entirely before anyone even clicked "connect."
// Deferring creation to first call means it only ever runs client-side, from an event handler.
let _publicClient: ReturnType<typeof createPublicClient> | null = null;
export function getPublicClient() {
  if (!RPC_URL) throw new Error("NEXT_PUBLIC_ARC_RPC_URL is not set — add it to web/.env.local");
  if (!_publicClient) {
    _publicClient = createPublicClient({ chain: arcTestnet, transport: http(RPC_URL) });
  }
  return _publicClient;
}

export function usdcToUnits(usd: number): bigint {
  return BigInt(Math.round(usd * 10 ** USDC_DECIMALS));
}

export function formatUsdcUnits(units: bigint): string {
  return (Number(units) / 10 ** USDC_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export async function getUsdcBalance(account: `0x${string}`): Promise<bigint> {
  return getPublicClient().readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  }) as Promise<bigint>;
}

/**
 * Confirmed live: a bind attempt with an underfunded wallet ($0.29 USDC against a $41.90
 * premium) reverted on-chain — nextPolicyId never incremented — but the only symptom the old
 * code surfaced was "PolicyBound event not found," which is a downstream effect, not the cause
 * (a reverted tx emits no logs, so the event-search always comes up empty on ANY revert, telling
 * you nothing about why). Checking the balance upfront, before spending gas on a doomed
 * transaction, is far more reliable than trying to decode Arc's native USDC predeploy's revert
 * reason after the fact — its exact revert behavior isn't guaranteed the way a normal ERC20's is.
 */
export async function requireSufficientBalance(account: `0x${string}`, requiredUnits: bigint): Promise<void> {
  const balance = await getUsdcBalance(account);
  if (balance < requiredUnits) {
    const short = formatUsdcUnits(requiredUnits - balance);
    throw new Error(
      `Insufficient USDC — this wallet needs $${short} more on Arc Testnet. Get free testnet USDC at faucet.circle.com.`
    );
  }
}

/** Step 1 of binding: approve the vault to pull `premium` USDC. Returns the tx hash once mined
 * and confirmed successful (checks receipt.status explicitly — waitForTransactionReceipt does
 * NOT throw on a reverted transaction by default, it just returns status: "reverted"). */
export async function approveUsdc(account: `0x${string}`, premium: bigint): Promise<`0x${string}`> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    account,
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: [POLICY_VAULT_ADDRESS, premium],
  });
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`USDC approval reverted on-chain (tx ${hash}) — check your balance and try again.`);
  }
  return hash;
}

/** Step 2 of binding: call bindPolicy() with an already-approved premium. Returns the tx hash
 * and the on-chain policyId parsed from the PolicyBound event log. */
export async function callBindPolicy(params: {
  account: `0x${string}`;
  coveredAddresses: `0x${string}`[];
  payoutAddress: `0x${string}`;
  coverageCap: bigint;
  premium: bigint;
  durationSeconds: number;
}): Promise<{ bindTxHash: `0x${string}`; onChainPolicyId: string }> {
  const wallet = getWalletClient();

  const bindHash = await wallet.writeContract({
    account: params.account,
    address: POLICY_VAULT_ADDRESS,
    abi: policyVaultAbi,
    functionName: "bindPolicy",
    args: [
      params.coveredAddresses,
      params.payoutAddress,
      params.coverageCap,
      params.premium,
      BigInt(params.durationSeconds),
    ],
  });
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash: bindHash });

  if (receipt.status !== "success") {
    throw new Error(
      `Bind transaction reverted on-chain (tx ${bindHash}) — the premium may not have been approved, or the wallet's USDC balance changed. Check the transaction on Arcscan for details.`
    );
  }

  const log = receipt.logs.find((l) => l.address.toLowerCase() === POLICY_VAULT_ADDRESS.toLowerCase());
  if (!log) {
    // Should be unreachable now that status is checked above, but keep a clear message rather
    // than a silent crash if PolicyVault's ABI/event signature ever changes.
    throw new Error(`Bind transaction succeeded (tx ${bindHash}) but no PolicyBound event was found — this needs investigation.`);
  }

  // topics[1] is the indexed policyId
  const onChainPolicyId = BigInt(log.topics[1] as `0x${string}`).toString();

  return { bindTxHash: bindHash, onChainPolicyId };
}
