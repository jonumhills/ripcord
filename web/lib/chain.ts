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
  const [address] = (await window.ethereum.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
  return address;
}

function getWalletClient() {
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

/** Approve the vault to pull `premium` USDC, then call bindPolicy(). Returns the bind tx hash
 * and the on-chain policyId parsed from the PolicyBound event log. */
export async function bindPolicyOnChain(params: {
  account: `0x${string}`;
  coveredAddresses: `0x${string}`[];
  payoutAddress: `0x${string}`;
  coverageCap: bigint;
  premium: bigint;
  durationSeconds: number;
}): Promise<{ bindTxHash: `0x${string}`; onChainPolicyId: string }> {
  const wallet = getWalletClient();

  const approveHash = await wallet.writeContract({
    account: params.account,
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: [POLICY_VAULT_ADDRESS, params.premium],
  });
  await getPublicClient().waitForTransactionReceipt({ hash: approveHash });

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

  const log = receipt.logs.find((l) => l.address.toLowerCase() === POLICY_VAULT_ADDRESS.toLowerCase());
  if (!log) throw new Error("PolicyBound event not found in bind transaction receipt");

  // topics[1] is the indexed policyId
  const onChainPolicyId = BigInt(log.topics[1] as `0x${string}`).toString();

  return { bindTxHash: bindHash, onChainPolicyId };
}
