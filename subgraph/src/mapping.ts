import { BigInt } from "@graphprotocol/graph-ts";
import { Approval } from "../generated/USDC/ERC20";
import { ApprovalEvent } from "../generated/schema";

// Same threshold backend/src/services/goldrush.ts uses for "unlimited" — kept in sync by hand,
// there's no shared package between the subgraph (AssemblyScript) and the backend (TypeScript).
const UNLIMITED_THRESHOLD = BigInt.fromString("1000000000000000000000000000000"); // 10^30

const SYMBOLS = new Map<string, string>();
SYMBOLS.set("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "USDC");
SYMBOLS.set("0xdac17f958d2ee523a2206206994597c13d831ec7", "USDT");
SYMBOLS.set("0x6b175474e89094c44da98b954eedeac495271d0f", "DAI");
SYMBOLS.set("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "WETH");

function symbolFor(tokenAddress: string): string {
  const known = SYMBOLS.get(tokenAddress.toLowerCase());
  return known ? known : "UNKNOWN";
}

// All four data sources in subgraph.yaml point at this same handler — event.address tells us
// which contract actually emitted it, so one function covers USDC/USDT/DAI/WETH.
export function handleApproval(event: Approval): void {
  const entity = new ApprovalEvent(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());

  entity.owner = event.params.owner;
  entity.spender = event.params.spender;
  entity.token = event.address;
  entity.tokenSymbol = symbolFor(event.address.toHexString());
  entity.amount = event.params.value;
  entity.isUnlimited = event.params.value.ge(UNLIMITED_THRESHOLD);
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}
