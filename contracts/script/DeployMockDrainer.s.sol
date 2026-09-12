// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockDrainer} from "../src/mocks/MockDrainer.sol";

/// @notice forge script script/DeployMockDrainer.s.sol --rpc-url arc_testnet --broadcast -vvvv
/// DEMO ONLY — see MockDrainer.sol's doc comment. Requires env: PRIVATE_KEY
contract DeployMockDrainer is Script {
    function run() external returns (MockDrainer drainer) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        drainer = new MockDrainer();
        vm.stopBroadcast();

        console.log("MockDrainer deployed at:", address(drainer));
    }
}
