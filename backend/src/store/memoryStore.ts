import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Policy, Address } from "../types.js";

/**
 * Not a database — a JSON file. Real DB reasoning still applies (no migrations, no connection
 * string, swap for Postgres before this is a real product), but pure in-memory turned out to be
 * actively annoying during development: every `npm run dev` restart (needed after almost any
 * backend code change) silently wiped every policy, which repeatedly confused testing — "delete
 * the policy" requests that turned out to already be empty, a freshly-bound policy disappearing
 * from the dashboard after an unrelated restart. Writing through to `.data/policies.json` (in
 * this package, gitignored) fixes that while keeping "wipe everything" one command away
 * (`rm -rf .data`) instead of a restart doing it as an unwanted side effect.
 */

const DATA_DIR = join(process.cwd(), ".data");
const DATA_FILE = join(DATA_DIR, "policies.json");

const policies = new Map<string, Policy>();
let nextId = 1;

function persist() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify({ nextId, policies: [...policies.values()] }, null, 2));
  } catch (err) {
    console.error("[memoryStore] failed to persist to disk:", err);
  }
}

function load() {
  if (!existsSync(DATA_FILE)) return;
  try {
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf-8")) as { nextId: number; policies: Policy[] };
    for (const p of raw.policies) policies.set(p.id, p);
    nextId = raw.nextId ?? policies.size + 1;
    console.log(`[memoryStore] loaded ${policies.size} polic${policies.size === 1 ? "y" : "ies"} from ${DATA_FILE}`);
  } catch (err) {
    console.error("[memoryStore] failed to load persisted data, starting empty:", err);
  }
}

load();

export function createPolicy(policy: Omit<Policy, "id">): Policy {
  const id = String(nextId++);
  const full: Policy = { ...policy, id };
  policies.set(id, full);
  persist();
  return full;
}

export function getPolicy(id: string): Policy | undefined {
  return policies.get(id);
}

export function updatePolicy(id: string, patch: Partial<Policy>): Policy | undefined {
  const existing = policies.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  policies.set(id, updated);
  persist();
  return updated;
}

export function listActivePolicies(): Policy[] {
  return [...policies.values()].filter((p) => p.active);
}

/** Admin-only in practice (gated at the route level, not here) — every policy regardless of
 * active/claimed status, for the admin dashboard/testing endpoints. */
export function listAllPolicies(): Policy[] {
  return [...policies.values()];
}

/** Removes a policy from the backend's own bookkeeping so it stops being monitored and the same
 * address(es) can be rebound for another test pass. Does NOT touch the on-chain PolicyVault —
 * see admin.ts's own doc comment for why that's a real limitation, not an oversight. */
export function deletePolicy(id: string): boolean {
  const existed = policies.delete(id);
  if (existed) persist();
  return existed;
}

/** Wipes every policy — the bulk version of deletePolicy(), for "start fresh" testing now that
 * policies survive a restart. Returns how many were removed. */
export function deleteAllPolicies(): number {
  const count = policies.size;
  policies.clear();
  persist();
  return count;
}

/** All active policies that cover a given address — what the monitor checks against on every event. */
export function findPoliciesCovering(address: Address): Policy[] {
  const target = address.toLowerCase();
  return listActivePolicies().filter((p) =>
    p.coveredAddresses.some((a) => a.toLowerCase() === target)
  );
}
