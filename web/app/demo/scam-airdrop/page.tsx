"use client";

import { useEffect, useState } from "react";
import { connectWallet, ensureArcChain, usdcToUnits, formatUsdcUnits } from "@/lib/chain";
import { approveScamAirdrop, triggerDrain, MOCK_DRAINER_ADDRESS } from "@/lib/demoDrain";
import { getPolicy, simulateIncident } from "@/lib/api";
import type { Policy } from "@/lib/types";

const EXPLORER_TX_BASE = "https://testnet.arcscan.app/tx/";
const DRAIN_AMOUNT_USD = 2; // modest, real, on-chain — leaves plenty of headroom for the rest of the demo

type Stage = "idle" | "connecting" | "approving" | "draining" | "drained" | "triggering" | "paid";

function shortHash(h: string) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

/**
 * STAGED DEMO — not a real airdrop, not deployed anywhere but your own browser for a recording.
 * Reproduces the actual mechanics of a wallet-drainer phishing site (approve a spending cap,
 * get pulled via transferFrom) against contracts/src/mocks/MockDrainer.sol on Arc testnet — a
 * real transaction you sign, a real transaction that drains it, both verifiable on Arcscan. Then
 * shows Ripcord's actual claims-agent payout path firing in response. See root README's demo
 * script for the full shot list.
 */
export default function ScamAirdropDemoPage() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [drainTxHash, setDrainTxHash] = useState<string | null>(null);
  const [policyIdInput, setPolicyIdInput] = useState("");
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [seconds, setSeconds] = useState(212); // pure flavor — a static countdown sells the urgency lure

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleClaim() {
    setError(null);
    try {
      setStage("connecting");
      const addr = await connectWallet();
      setAccount(addr);
      await ensureArcChain();

      setStage("approving");
      await approveScamAirdrop(addr, usdcToUnits(DRAIN_AMOUNT_USD));

      setStage("draining");
      const hash = await triggerDrain(addr, addr);
      setDrainTxHash(hash);
      setStage("drained");
    } catch (err) {
      setStage("idle");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleTriggerPayout() {
    if (!account || !drainTxHash || !policyIdInput) return;
    setError(null);
    setStage("triggering");
    try {
      await simulateIncident({
        policyId: policyIdInput,
        triggerAddress: MOCK_DRAINER_ADDRESS,
        fromAddress: account,
        txHash: drainTxHash,
      });
      const { policy: updated } = await getPolicy(policyIdInput);
      setPolicy(updated);
      setStage("paid");
    } catch (err) {
      setStage("drained");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #1a0b2e 0%, #3b0764 45%, #831843 100%)",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          background: "#000a",
          border: "1px solid #ffffff33",
          borderRadius: 999,
          padding: "6px 14px",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          zIndex: 10,
        }}
      >
        Staged demo — not a real airdrop
      </div>

      <div style={{ maxWidth: 480, width: "100%", marginTop: 48, textAlign: "center" }}>
        {stage !== "drained" && stage !== "triggering" && stage !== "paid" && (
          <>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>⏰ Offer ends in {mins}:{secs}</div>
            <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, margin: 0 }}>
              🎉 You're eligible for 500 FREE $RIP tokens!
            </h1>
            <p style={{ opacity: 0.85, marginTop: 16, lineHeight: 1.6 }}>
              Verified airdrop for early Arc network wallets. Connect your wallet and approve the
              gas resupply to claim instantly — first come, first served.
            </p>

            <button
              onClick={handleClaim}
              disabled={stage === "connecting" || stage === "approving" || stage === "draining"}
              style={{
                marginTop: 28,
                padding: "16px 32px",
                fontSize: 16,
                fontWeight: 700,
                border: "none",
                borderRadius: 12,
                background: "linear-gradient(90deg, #f472b6, #a855f7)",
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 8px 24px #a855f766",
              }}
            >
              {stage === "idle" && "Connect Wallet & Claim →"}
              {stage === "connecting" && "Connecting…"}
              {stage === "approving" && "Confirm in wallet…"}
              {stage === "draining" && "Claiming…"}
            </button>

            <p style={{ fontSize: 11, opacity: 0.5, marginTop: 20 }}>
              ✅ Verified contract &nbsp; ✅ Audited &nbsp; ✅ 12,400 claimed today
            </p>
          </>
        )}

        {(stage === "drained" || stage === "triggering" || stage === "paid") && (
          <div
            style={{
              background: "#0009",
              border: "1px solid #ffffff22",
              borderRadius: 16,
              padding: 28,
              textAlign: "left",
            }}
          >
            {stage !== "paid" && (
              <>
                <div style={{ fontSize: 32 }}>💀</div>
                <h2 style={{ fontSize: 22, marginTop: 8 }}>Your wallet was just drained</h2>
                <p style={{ opacity: 0.8, marginTop: 10, lineHeight: 1.6, fontSize: 14 }}>
                  That "claim" button approved a spending cap, and this page pulled it the instant
                  you signed — exactly how a real wallet-drainer phishing site works. This was
                  ${DRAIN_AMOUNT_USD} in testnet USDC, on Arc, for real.
                </p>
                {drainTxHash && (
                  <a
                    href={`${EXPLORER_TX_BASE}${drainTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "block", marginTop: 10, fontSize: 12, color: "#f0abfc", fontFamily: "monospace" }}
                  >
                    {shortHash(drainTxHash)} ↗
                  </a>
                )}

                <div style={{ height: 1, background: "#ffffff22", margin: "20px 0" }} />

                <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
                  This is exactly the scenario Ripcord covers. Enter the policy ID covering this
                  wallet to trigger the same automatic payout the live monitor would.
                </p>
                <input
                  value={policyIdInput}
                  onChange={(e) => setPolicyIdInput(e.target.value)}
                  placeholder="Policy ID (see your dashboard)"
                  style={{
                    marginTop: 12,
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ffffff33",
                    background: "#ffffff11",
                    color: "#fff",
                    fontSize: 14,
                  }}
                />
                <button
                  onClick={handleTriggerPayout}
                  disabled={!policyIdInput || stage === "triggering"}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    padding: "12px",
                    borderRadius: 8,
                    border: "none",
                    background: "#33e667",
                    color: "#06170b",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {stage === "triggering" ? "Paying out…" : "Trigger Ripcord's automatic payout →"}
                </button>
              </>
            )}

            {stage === "paid" && policy && (
              <>
                <div style={{ fontSize: 32 }}>✅</div>
                <h2 style={{ fontSize: 22, marginTop: 8, color: "#33e667" }}>Claim paid — automatically</h2>
                <p style={{ opacity: 0.85, marginTop: 10, lineHeight: 1.6, fontSize: 14 }}>
                  ${formatUsdcUnits(BigInt(policy.coverageCap))} USDC sent to{" "}
                  <span style={{ fontFamily: "monospace" }}>{policy.payoutAddress}</span> — no claim
                  form, no review, no wait. Detected → paid, start to finish, in one transaction.
                </p>
                {policy.claimTxHash && (
                  <a
                    href={`${EXPLORER_TX_BASE}${policy.claimTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "block", marginTop: 10, fontSize: 12, color: "#33e667", fontFamily: "monospace" }}
                  >
                    {shortHash(policy.claimTxHash)} ↗
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <p style={{ marginTop: 16, fontSize: 13, color: "#fca5a5", background: "#000a", padding: 12, borderRadius: 8 }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
