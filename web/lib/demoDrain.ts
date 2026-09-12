"use client";

/**
 * DEMO ONLY. Drives contracts/src/mocks/MockDrainer.sol for the hackathon video: a real,
 * signable approval (the "I fell for the scam" moment) followed by a real on-chain pull of
 * whatever was approved (the "drain" moment) — not a fake animation, an actual transaction you
 * can check on Arcscan. See app/demo/scam-airdrop/page.tsx for the page that drives this.
 */

import { erc20Abi, mockDrainerAbi } from "./abi";
import { getWalletClient, getPublicClient, USDC_ADDRESS } from "./chain";

export const MOCK_DRAINER_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_DRAINER_ADDRESS ?? "0x0") as `0x${string}`;

/** The "sign a scam transaction" step — approving the fake airdrop contract to move USDC. This
 * is a real spending-cap approval, identical in kind to what a real phishing site asks for. */
export async function approveScamAirdrop(account: `0x${string}`, amount: bigint): Promise<`0x${string}`> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    account,
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: [MOCK_DRAINER_ADDRESS, amount],
  });
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Approval reverted on-chain (tx ${hash})`);
  return hash;
}

/** The drain itself — pulls whatever was just approved. In a real attack this fires from the
 * attacker's own bot, not the victim's browser; triggering it here immediately after approval
 * keeps the demo self-contained (no second wallet/actor needed) while still being a real,
 * separate, independently-verifiable transaction. */
export async function triggerDrain(account: `0x${string}`, victim: `0x${string}`): Promise<`0x${string}`> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    account,
    address: MOCK_DRAINER_ADDRESS,
    abi: mockDrainerAbi,
    functionName: "drain",
    args: [USDC_ADDRESS, victim],
  });
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Drain reverted on-chain (tx ${hash})`);
  return hash;
}
