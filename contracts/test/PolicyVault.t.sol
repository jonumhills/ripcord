// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyVault} from "../src/PolicyVault.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Proves the actual demo path end-to-end: bind a policy, pay premium, then the claims
/// agent — and only the claims agent — pays out on trigger. This is what backend/src/agents/
/// claimsAgent.ts calls in production; these tests are the on-chain half of the same story.
contract PolicyVaultTest is Test {
    PolicyVault vault;
    MockUSDC usdc;

    address holder = address(0xA11CE);
    address payoutAddress = address(0xBEEF);
    address claimsAgent = address(0xC1A1AA);
    address strangerAddress = address(0xBAD);
    address insuredWallet = address(0x1111);
    address drainerAddress = address(0xD2A1);

    uint256 constant COVERAGE_CAP = 1_000 * 1e6; // $1,000 USDC
    uint256 constant PREMIUM = 15 * 1e6; // $15 USDC
    uint64 constant DURATION = 365 days;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new PolicyVault(address(usdc), claimsAgent);

        usdc.mint(holder, PREMIUM);
        vm.prank(holder);
        usdc.approve(address(vault), PREMIUM);
    }

    function _bindPolicy() internal returns (uint256 policyId) {
        address[] memory covered = new address[](1);
        covered[0] = insuredWallet;

        vm.prank(holder);
        policyId = vault.bindPolicy(covered, payoutAddress, COVERAGE_CAP, PREMIUM, DURATION);
    }

    function test_bindPolicy_pullsPremiumAndStoresPolicy() public {
        uint256 policyId = _bindPolicy();

        assertEq(usdc.balanceOf(address(vault)), PREMIUM, "premium should sit in the vault");
        assertEq(usdc.balanceOf(holder), 0, "holder's premium should be pulled");

        (address _holder, address _payout, uint256 cap, uint256 premium,,, bool claimed, bool active) =
            vault.policies(policyId);
        assertEq(_holder, holder);
        assertEq(_payout, payoutAddress);
        assertEq(cap, COVERAGE_CAP);
        assertEq(premium, PREMIUM);
        assertFalse(claimed);
        assertTrue(active);

        address[] memory covered = vault.getCoveredAddresses(policyId);
        assertEq(covered.length, 1);
        assertEq(covered[0], insuredWallet);
    }

    function test_claimsAgent_canPayClaim_onFlaggedDrain() public {
        uint256 policyId = _bindPolicy();
        usdc.mint(address(vault), COVERAGE_CAP - PREMIUM); // fund the vault's reserve beyond just this premium

        bytes32 evidenceHash = keccak256("drain tx evidence");

        vm.prank(claimsAgent);
        vault.payClaim(policyId, drainerAddress, evidenceHash);

        assertEq(usdc.balanceOf(payoutAddress), COVERAGE_CAP, "payout should land at the payout address");

        (,,,,,, bool claimed, bool active) = vault.policies(policyId);
        assertTrue(claimed);
        assertFalse(active);
    }

    function test_revert_whenStrangerCallsPayClaim() public {
        uint256 policyId = _bindPolicy();
        usdc.mint(address(vault), COVERAGE_CAP);

        vm.prank(strangerAddress);
        vm.expectRevert(PolicyVault.NotClaimsAgent.selector);
        vault.payClaim(policyId, drainerAddress, keccak256("evidence"));
    }

    function test_revert_onDoubleClaim() public {
        uint256 policyId = _bindPolicy();
        usdc.mint(address(vault), COVERAGE_CAP * 2);

        vm.prank(claimsAgent);
        vault.payClaim(policyId, drainerAddress, keccak256("evidence-1"));

        // payClaim sets active=false on the first payout, so a second attempt trips the
        // "not active" check before it ever reaches the claimed check — still correctly
        // blocked, just via a different guard than you might guess from the function name alone.
        vm.prank(claimsAgent);
        vm.expectRevert(PolicyVault.PolicyNotActive.selector);
        vault.payClaim(policyId, drainerAddress, keccak256("evidence-2"));
    }

    function test_revert_onExpiredPolicy() public {
        uint256 policyId = _bindPolicy();
        usdc.mint(address(vault), COVERAGE_CAP);

        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(claimsAgent);
        vm.expectRevert(PolicyVault.PolicyExpired.selector);
        vault.payClaim(policyId, drainerAddress, keccak256("evidence"));
    }

    function test_revert_bindPolicy_withNoCoveredAddresses() public {
        address[] memory empty = new address[](0);
        vm.prank(holder);
        vm.expectRevert(PolicyVault.NoCoveredAddresses.selector);
        vault.bindPolicy(empty, payoutAddress, COVERAGE_CAP, PREMIUM, DURATION);
    }

    function test_revert_constructor_withZeroAddress() public {
        vm.expectRevert(PolicyVault.ZeroAddress.selector);
        new PolicyVault(address(0), claimsAgent);
    }
}
