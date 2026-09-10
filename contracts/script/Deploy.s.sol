// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PolicyVault} from "../src/PolicyVault.sol";

/// @notice forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast -vvvv
/// Requires env: PRIVATE_KEY, ARC_USDC_ADDRESS, CLAIMS_AGENT_ADDRESS
contract Deploy is Script {
    function run() external returns (PolicyVault vault) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        address claimsAgent = vm.envAddress("CLAIMS_AGENT_ADDRESS");

        vm.startBroadcast(deployerKey);
        vault = new PolicyVault(usdc, claimsAgent);
        vm.stopBroadcast();

        console.log("PolicyVault deployed at:", address(vault));
        console.log("USDC:", usdc);
        console.log("Claims agent:", claimsAgent);
    }
}
