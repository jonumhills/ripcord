import { createHash } from "node:crypto";
import { getPolicy, updatePolicy } from "../store/memoryStore.js";
import { payClaimOnChain } from "../chain/arcClient.js";
import { logEvidenceToHcs } from "../hedera/hcsLogger.js";
import type { Incident } from "../types.js";

/**
 * The claims agent: the one piece of code authorized to move money out of the vault. No human
 * approves this — it independently verifies the incident against the policy and fires the
 * on-chain payout itself. This is "autonomous agents transacting on Arc with USDC," and it's
 * also the entire product pitch: detection is the claim.
 */
export async function handleIncident(incident: Incident): Promise<void> {
  const policy = getPolicy(incident.policyId);

  if (!policy) {
    console.error(`[claimsAgent] no such policy: ${incident.policyId}`);
    return;
  }
  if (!policy.active || policy.claimed) {
    console.warn(`[claimsAgent] policy ${policy.id} not payable (active=${policy.active}, claimed=${policy.claimed})`);
    return;
  }
  if (new Date(policy.expiry).getTime() < Date.now()) {
    console.warn(`[claimsAgent] policy ${policy.id} expired`);
    return;
  }
  if (!policy.onChainPolicyId) {
    console.error(`[claimsAgent] policy ${policy.id} has no on-chain id — was it bound?`);
    return;
  }

  const evidence = {
    policyId: policy.id,
    onChainPolicyId: policy.onChainPolicyId,
    triggerAddress: incident.triggerAddress,
    fromAddress: incident.fromAddress,
    txHash: incident.txHash,
    matchedReason: incident.matchedReason,
    detectedAt: incident.detectedAt,
  };
  const evidenceHash = `0x${createHash("sha256").update(JSON.stringify(evidence)).digest("hex")}` as const;

  console.log(`[claimsAgent] paying claim for policy ${policy.id}, evidence ${evidenceHash}`);

  const receipt = await payClaimOnChain(
    BigInt(policy.onChainPolicyId),
    incident.triggerAddress,
    evidenceHash
  );

  updatePolicy(policy.id, {
    active: false,
    claimed: true,
    claimedAt: new Date().toISOString(),
    claimTxHash: receipt.transactionHash,
    claimTriggerAddress: incident.triggerAddress,
  });

  // Optional stretch — no-ops if Hedera isn't configured.
  const hcsSequence = await logEvidenceToHcs({ ...evidence, payoutTxHash: receipt.transactionHash }).catch(
    (err) => {
      console.warn("[claimsAgent] HCS logging skipped/failed:", err);
      return null;
    }
  );

  console.log(
    `[claimsAgent] paid policy ${policy.id} — tx ${receipt.transactionHash}${
      hcsSequence ? `, HCS seq ${hcsSequence}` : ""
    }`
  );
}
