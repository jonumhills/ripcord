import { decodeEventLog, parseAbiItem } from "viem";
import { publicClient } from "../chain/arcClient.js";
import { getPolicy } from "../store/policyStore.js";
import { createClaim, updateClaim } from "../store/claimStore.js";
import { isFlaggedAddress } from "../services/scamsniffer.js";
import { executePayout } from "./claimsAgent.js";
import { config } from "../config.js";
import type { Address, Claim, ClaimCheck } from "../types.js";

/**
 * The adjuster: given a policy and a transaction hash someone claims is a covered drain, reads
 * the ACTUAL transaction from Arc and independently verifies it — never trusts the caller's
 * word for what happened. Every check runs and gets recorded, in order, whether it passes or
 * fails, so the resulting `reasoning` is assembled from real facts about the transaction, not a
 * canned response. This is the single entry point for both paths that can trigger a payout:
 * a user manually submitting a tx hash (routes/claims.ts) and the live monitor auto-detecting
 * one (walletMonitor.ts) — both go through the exact same verification, so there's one place
 * that decides what counts as a valid claim, not two that could quietly disagree.
 *
 * Deliberately NOT an LLM call. "Adjuster reasoning" here means deterministic, re-runnable,
 * fact-based reasoning — the same transaction always produces the same verdict — which is what
 * actually backs up the product's own pitch ("provable, unfakeable") rather than undermining it
 * with a non-deterministic judgment call.
 */

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

// Demo/manual-override flagged addresses, additive to the real ScamSniffer registry — e.g.
// contracts/src/mocks/MockDrainer.sol's own address, which obviously isn't (and shouldn't be) on
// a real third-party scam registry. Comma-separated env var, empty by default.
const DEMO_FLAGGED_ADDRESSES = (process.env.DEMO_FLAGGED_ADDRESSES ?? "")
  .split(",")
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

/** Exported so walletMonitor.ts can use the exact same check as a cheap pre-filter before it
 * even creates a claim — avoids spamming the claims table with a "denied" record for every
 * ordinary outgoing transfer an insured wallet makes, while keeping this function itself as the
 * single place that decides what counts as flagged (the monitor's pre-filter and the adjuster's
 * real check can never quietly disagree, because they're the same function). */
export async function isFlaggedForClaims(address: Address): Promise<{ flagged: boolean; source: string | null }> {
  if (DEMO_FLAGGED_ADDRESSES.includes(address.toLowerCase())) {
    return { flagged: true, source: "Ripcord's demo flagged-address list" };
  }
  const onScamSniffer = await isFlaggedAddress(address).catch(() => false);
  return onScamSniffer ? { flagged: true, source: "the ScamSniffer registry" } : { flagged: false, source: null };
}

export async function reviewAndPayClaim(policyId: string, submittedTxHash: string): Promise<Claim> {
  let claim = await createClaim(policyId, submittedTxHash);
  const checks: ClaimCheck[] = [];
  const add = (label: string, passed: boolean, detail: string) => checks.push({ label, passed, detail });

  async function deny(reasoning: string): Promise<Claim> {
    return (await updateClaim(claim.id, {
      status: "denied",
      verdict: "denied",
      reasoning,
      checks,
      reviewedAt: new Date().toISOString(),
    }))!;
  }

  const policy = await getPolicy(policyId);
  add("Policy exists", Boolean(policy), policy ? `Policy #${policyId} found` : `No policy with id ${policyId}`);
  if (!policy) return deny(`No policy with id ${policyId} exists. Claim denied.`);

  add("Policy is active", policy.active, policy.active ? "Active" : "Not active — expired, cancelled, or already claimed");
  if (!policy.active) return deny(`Policy #${policyId} is not active. Claim denied.`);

  add("Policy has not already been claimed", !policy.claimed, policy.claimed ? "A claim has already been paid on this policy" : "No prior claim");
  if (policy.claimed) return deny(`Policy #${policyId} already had a claim paid — each policy covers one payout. Claim denied.`);

  const notExpired = new Date(policy.expiry).getTime() > Date.now();
  add("Policy has not expired", notExpired, `Expires ${policy.expiry}`);
  if (!notExpired) return deny(`Policy #${policyId} expired on ${policy.expiry}. Claim denied.`);

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: submittedTxHash as `0x${string}` });
  } catch {
    add("Transaction found on Arc", false, `No transaction found for ${submittedTxHash}`);
    return deny(`Could not find transaction ${submittedTxHash} on Arc. Claim denied.`);
  }
  add("Transaction found on Arc", true, `Confirmed in block ${receipt.blockNumber}`);

  add("Transaction succeeded", receipt.status === "success", `On-chain status: ${receipt.status}`);
  if (receipt.status !== "success") return deny(`Transaction ${submittedTxHash} reverted on-chain — no funds actually moved. Claim denied.`);

  const coveredSet = new Set(policy.coveredAddresses.map((a) => a.toLowerCase()));
  let matched: { from: Address; to: Address; token: Address; value: bigint } | null = null;

  // Only logs from the real USDC contract count. Confirmed live: Arc emits a SECOND,
  // Transfer-shaped log for every USDC movement from the sentinel address
  // 0xfff...fe (USDC doubles as Arc's native gas currency, and the node mirrors every ERC20
  // transfer as a native-currency-style log too) — same from/to, same value, just expressed in
  // 18 decimals instead of USDC's 6. Scanning receipt.logs without filtering by contract address
  // picks up that sentinel log first (it's emitted before the real one) and records the wrong
  // token/amount, even though the from/to happen to match — the payout itself was unaffected
  // (it pays policy.coverageCap, not this parsed amount) but the claim record was wrong.
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== config.arc.usdcAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: [TRANSFER_EVENT], data: log.data, topics: log.topics });
      const from = (decoded.args.from as string).toLowerCase();
      if (coveredSet.has(from)) {
        matched = {
          from: from as Address,
          to: (decoded.args.to as string).toLowerCase() as Address,
          token: log.address.toLowerCase() as Address,
          value: decoded.args.value as bigint,
        };
        break;
      }
    } catch {
      continue; // not a Transfer-shaped log — skip rather than fail the whole review
    }
  }

  add(
    "Sender matches an address covered by this policy",
    Boolean(matched),
    matched ? `${matched.from} is covered by policy #${policyId}` : `No transfer in this transaction originates from a covered address (${policy.coveredAddresses.join(", ")})`
  );
  if (!matched) return deny(`Transaction ${submittedTxHash} doesn't show funds leaving any address covered by policy #${policyId}. Claim denied.`);

  const { flagged, source } = await isFlaggedForClaims(matched.to);
  add(
    "Destination is a recognized flagged address",
    flagged,
    flagged ? `${matched.to} found on ${source}` : `${matched.to} is not on any registry Ripcord checks`
  );
  if (!flagged) {
    return deny(
      `${matched.to} received the funds, but isn't a recognized malicious destination — checked the ScamSniffer registry and Ripcord's own demo list. Ripcord only covers transfers to known-bad addresses, not general losses or mistaken sends. Claim denied.`
    );
  }

  const reasoning = `Transaction ${submittedTxHash} (confirmed on Arc, block ${receipt.blockNumber}) shows ${matched.value.toString()} units of token ${matched.token} moving from the insured wallet ${matched.from} to ${matched.to} — a destination found on ${source}. This matches policy #${policyId}'s parametric trigger: an outgoing transfer to a known-malicious address. Claim approved for the full coverage amount.`;

  claim = (await updateClaim(claim.id, {
    status: "approved",
    verdict: "approved",
    fromAddress: matched.from,
    triggerAddress: matched.to,
    tokenAddress: matched.token,
    amount: matched.value.toString(),
    reasoning,
    checks,
    reviewedAt: new Date().toISOString(),
  }))!;

  return executePayout(claim, policy);
}
