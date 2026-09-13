// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
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
/// the flagged destination for the demo — the first Transfer(victim, drainer, amount) is what
/// claimsAdjuster.ts matches against DEMO_FLAGGED_ADDRESSES. A real drainer bot would keep the
/// funds; this one forwards them straight into PolicyVault's reserve instead (see `drain` below)
/// so repeat demo runs are self-funding rather than stranding real testnet USDC in this contract
/// forever with no withdraw function.
contract MockDrainer {
    /// @notice PolicyVault's own address — where every drain forwards what it pulls. Fixed at
    /// deploy time, same as a real drainer bot already knows where its own take goes.
    address public immutable vault;

    event Drained(address indexed victim, address indexed token, uint256 amount);

    constructor(address vault_) {
        require(vault_ != address(0), "zero vault");
        vault = vault_;
    }

    /// @notice Pulls whatever `victim` has approved this contract to spend, then forwards it to
    /// `vault` in the same call — two real Transfer events, victim->this then this->vault.
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

        // Forward straight into the vault's reserve — claimsAdjuster.ts only inspects the FIRST
        // Transfer whose `from` is a covered address (victim->this, above), so this second leg
        // doesn't touch the flagged-destination check at all; it's purely the money ending up
        // where the claim this drain triggers will actually pay out from.
        bool forwarded = IERC20(token).transfer(vault, amount);
        require(forwarded, "forward to vault failed");
    }
}
