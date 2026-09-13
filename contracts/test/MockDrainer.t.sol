// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockDrainer} from "../src/mocks/MockDrainer.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Proves the demo drain actually moves funds the same way a real phishing drain does:
/// the victim approves (this test's stand-in for signing the malicious "claim" transaction), then
/// anyone can trigger the pull — nothing about the victim's own second signature is required.
contract MockDrainerTest is Test {
    MockDrainer drainer;
    MockUSDC usdc;

    address victim = address(0xBEEF);
    address attackerBot = address(0xB07); // whoever calls drain() — permissionless on purpose
    address vault = address(0xFEED); // stand-in for PolicyVault — where drained funds now land

    function setUp() public {
        usdc = new MockUSDC();
        drainer = new MockDrainer(vault);
        usdc.mint(victim, 1_000 * 1e6);
    }

    function test_drain_pullsWhateverWasApproved() public {
        vm.prank(victim);
        usdc.approve(address(drainer), 250 * 1e6); // the "sign a scam transaction" moment

        vm.prank(attackerBot);
        uint256 pulled = drainer.drain(address(usdc), victim);

        assertEq(pulled, 250 * 1e6);
        // Funds don't stop at the drainer — they're forwarded to the vault in the same call, so
        // the drainer itself ends up holding nothing.
        assertEq(usdc.balanceOf(address(drainer)), 0);
        assertEq(usdc.balanceOf(vault), 250 * 1e6);
        assertEq(usdc.balanceOf(victim), 750 * 1e6);
    }

    function test_revert_whenNothingApproved() public {
        vm.expectRevert("nothing to drain");
        drainer.drain(address(usdc), victim);
    }

    function test_drain_pullsFullUnlimitedApproval() public {
        vm.prank(victim);
        usdc.approve(address(drainer), type(uint256).max);

        drainer.drain(address(usdc), victim);
        assertEq(usdc.balanceOf(victim), 0); // unlimited approval = everything is at risk
        assertEq(usdc.balanceOf(vault), 1_000 * 1e6); // and it all lands in the vault, not stuck here
    }

    function test_revert_whenZeroVault() public {
        vm.expectRevert("zero vault");
        new MockDrainer(address(0));
    }
}
