import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";
import { policyVaultAbi } from "./policyVaultAbi.js";

/**
 * Arc testnet chain definition. Confirm the current chain id / RPC / explorer from Arc's docs
 * before demoing — these placeholders exist so the client compiles without them.
 */
const arcTestnet: Chain = {
  id: config.arc.chainId || 0,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [config.arc.rpcUrl] } },
};

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(config.arc.rpcUrl),
});

// The claims agent's own account — the only key authorized to call payClaim() on-chain.
// This is what makes "the detection is the claim" literally true: no human signs this transaction.
const claimsAgentAccount = config.arc.claimsAgentPrivateKey
  ? privateKeyToAccount(config.arc.claimsAgentPrivateKey)
  : undefined;

export const claimsAgentWalletClient = claimsAgentAccount
  ? createWalletClient({
      account: claimsAgentAccount,
      chain: arcTestnet,
      transport: http(config.arc.rpcUrl),
    })
  : undefined;

export async function payClaimOnChain(
  onChainPolicyId: bigint,
  triggerAddress: `0x${string}`,
  evidenceHash: `0x${string}`
) {
  if (!claimsAgentWalletClient) {
    throw new Error("Claims agent wallet not configured — set CLAIMS_AGENT_PRIVATE_KEY");
  }

  const hash = await claimsAgentWalletClient.writeContract({
    address: config.arc.policyVaultAddress,
    abi: policyVaultAbi,
    functionName: "payClaim",
    args: [onChainPolicyId, triggerAddress, evidenceHash],
  });

  return publicClient.waitForTransactionReceipt({ hash });
}

export async function readPolicy(onChainPolicyId: bigint) {
  return publicClient.readContract({
    address: config.arc.policyVaultAddress,
    abi: policyVaultAbi,
    functionName: "policies",
    args: [onChainPolicyId],
  });
}
