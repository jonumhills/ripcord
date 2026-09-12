import { createHash } from "node:crypto";
import { updatePolicy } from "../store/policyStore.js";
import { updateClaim } from "../store/claimStore.js";
import { payClaimOnChain } from "../chain/arcClient.js";
import { logEvidenceToHcs } from "../hedera/hcsLogger.js";
import type { Address, Claim, Policy } from "../types.js";

/**
 * The claims agent: the one piece of code authorized to move money out of the vault. No human
 * approves this — once claimsAdjuster.ts has verified a claim and set it to "approved", this
 * executes the on-chain payout and nothing else. Verification/reasoning live in the adjuster;
 * this file is deliberately narrow — it only knows how to pay, not whether it should.
 */
export async function executePayout(claim: Claim, policy: Policy): Promise<Claim> {
  if (!policy.onChainPolicyId) {
    return (await updateClaim(claim.id, {
      status: "failed",
      failureReason: "Policy has no on-chain id — it was never actually bound to PolicyVault.",
    }))!;
  }

  await updateClaim(claim.id, { status: "paying" });

  const evidence = {
    claimId: claim.id,
    policyId: policy.id,
    submittedTxHash: claim.submittedTxHash,
    triggerAddress: claim.triggerAddress,
    reasoning: claim.reasoning,
  };
  const evidenceHash = `0x${createHash("sha256").update(JSON.stringify(evidence)).digest("hex")}` as const;

  console.log(`[claimsAgent] paying claim ${claim.id} (policy ${policy.id}), evidence ${evidenceHash}`);

  let receipt;
  try {
    receipt = await payClaimOnChain(
      BigInt(policy.onChainPolicyId),
      claim.triggerAddress as Address,
      evidenceHash
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[claimsAgent] payout failed for claim ${claim.id}:`, message);
    return (await updateClaim(claim.id, { status: "failed", failureReason: message }))!;
  }

  await updatePolicy(policy.id, {
    active: false,
    claimed: true,
    claimedAt: new Date().toISOString(),
    claimTxHash: receipt.transactionHash,
    claimTriggerAddress: claim.triggerAddress as Address,
  });

  const updated = (await updateClaim(claim.id, {
    status: "paid",
    payoutTxHash: receipt.transactionHash,
    paidAt: new Date().toISOString(),
  }))!;

  // Optional stretch — no-ops if Hedera isn't configured.
  logEvidenceToHcs({ ...evidence, payoutTxHash: receipt.transactionHash }).catch((err) => {
    console.warn("[claimsAgent] HCS logging skipped/failed:", err);
  });

  console.log(`[claimsAgent] paid claim ${claim.id} — tx ${receipt.transactionHash}`);
  return updated;
}
