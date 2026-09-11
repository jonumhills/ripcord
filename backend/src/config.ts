import "dotenv/config";

function optional(name: string): string {
  return process.env[name] ?? "";
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Don't throw at import time in dev — routes that need a missing key fail loudly
    // and individually instead of killing the whole server, which matters when you're
    // demoing with half the API keys wired up and half still stubbed.
    console.warn(`[config] ${name} is not set — anything depending on it will fail`);
  }
  return value ?? "";
}

export const config = {
  port: Number(optional("PORT") || 8080),
  corsOrigins: optional("CORS_ORIGINS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  graph: {
    tokenApiKey: required("GRAPH_TOKEN_API_KEY"),
    // Verified 2026-09-09: thegraph.com/docs/en/token-api/quick-start/ redirects to Pinax, who
    // operate the Token API for The Graph. api.pinax.network is the real host, not a guess.
    tokenApiBaseUrl: optional("GRAPH_TOKEN_API_BASE_URL") || "https://api.pinax.network",
    // Confirmed supported: mainnet, base, arbitrum-one, solana. Arc is NOT supported — this is
    // the network where insured wallets have their actual history, unrelated to Arc (which is
    // only PolicyVault's settlement chain). See backend/README.md.
    tokenApiNetwork: optional("GRAPH_TOKEN_API_NETWORK") || "mainnet",
    subgraphUrl: optional("GRAPH_SUBGRAPH_URL"),
  },

  goldrush: {
    apiKey: required("GOLDRUSH_API_KEY"),
    chainName: optional("GOLDRUSH_CHAIN_NAME") || "eth-mainnet",
  },

  scamsniffer: {
    addressListUrl:
      optional("SCAMSNIFFER_ADDRESS_LIST_URL") ||
      "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json",
  },

  sourcify: {
    baseUrl: optional("SOURCIFY_BASE_URL") || "https://sourcify.dev/server",
    // The wallet's home chain (mainnet=1 by default), NOT Arc — approval spenders live wherever
    // the insured wallet is actually active, same chain as GRAPH_TOKEN_API_NETWORK/GOLDRUSH_CHAIN_NAME.
    // An earlier version of riskEngine.ts wrongly passed Arc's chain id here, which would have
    // checked mainnet contract addresses against Arc's (empty) verification records.
    walletChainId: Number(optional("WALLET_CHAIN_ID") || 1),
  },

  arc: {
    rpcUrl: required("ARC_TESTNET_RPC_URL"),
    chainId: Number(optional("ARC_CHAIN_ID") || 0),
    usdcAddress: required("ARC_USDC_ADDRESS") as `0x${string}`,
    policyVaultAddress: required("POLICY_VAULT_ADDRESS") as `0x${string}`,
    claimsAgentPrivateKey: required("CLAIMS_AGENT_PRIVATE_KEY") as `0x${string}`,
  },

  database: {
    // A direct Postgres connection string (Supabase's session pooler, port 5432 — recommended
    // for a persistent long-running server like this one on Railway, vs. the transaction pooler
    // on 6543 which is meant for serverless/edge). Run backend/supabase/schema.sql once on the
    // project before first use.
    url: required("DATABASE_URL"),
  },

  admin: {
    // Gate for DELETE/PATCH on policies — testing-only surface, not a customer-facing feature
    // (a real insurer doesn't let a policyholder edit their own coverage). Deliberately not
    // `required()`: an unset key should mean the admin routes refuse everything, not fall back
    // to some hardcoded default that would ship as a real vulnerability if this got deployed.
    apiKey: optional("ADMIN_API_KEY"),
  },

  hedera: {
    operatorId: optional("HEDERA_OPERATOR_ID"),
    operatorKey: optional("HEDERA_OPERATOR_KEY"),
    hcsTopicId: optional("HEDERA_HCS_TOPIC_ID"),
    get enabled() {
      return Boolean(this.operatorId && this.operatorKey && this.hcsTopicId);
    },
  },
};
