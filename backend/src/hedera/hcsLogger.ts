import { config } from "../config.js";

/**
 * Optional stretch, not load-bearing: logs claim evidence hashes to Hedera Consensus Service as
 * a tamper-proof audit trail. Entirely skippable — every call in this file no-ops if Hedera env
 * vars aren't set, so leaving this out costs nothing in the core flow.
 *
 * Requires `npm install @hashgraph/sdk` if you decide to wire this up — left out of
 * package.json's dependencies on purpose so the base backend install stays lean.
 */
export async function logEvidenceToHcs(evidence: Record<string, unknown>): Promise<string | null> {
  if (!config.hedera.enabled) return null;

  // Lazy import so @hashgraph/sdk is only required at runtime if this path is actually used.
  // @ts-ignore — not a declared dependency until you `npm install @hashgraph/sdk` to enable this.
  const { Client, TopicMessageSubmitTransaction, PrivateKey } = await import("@hashgraph/sdk");

  const client = Client.forTestnet().setOperator(
    config.hedera.operatorId,
    PrivateKey.fromStringECDSA(config.hedera.operatorKey)
  );

  const tx = await new TopicMessageSubmitTransaction({
    topicId: config.hedera.hcsTopicId,
    message: JSON.stringify(evidence),
  }).execute(client);

  const receipt = await tx.getReceipt(client);
  return receipt.topicSequenceNumber?.toString() ?? null;
}
