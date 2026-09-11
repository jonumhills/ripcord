import type { Policy, Address } from "../types.js";

/**
 * In-memory store — deliberately not a database. For a hackathon demo this is a feature, not a
 * shortcut: no migrations, no connection string to wire into Railway, restart-to-reset for a
 * clean demo run. Swap for Postgres before this becomes a real product — every read/write goes
 * through this module so that's a one-file change later.
 */

const policies = new Map<string, Policy>();
let nextId = 1;

export function createPolicy(policy: Omit<Policy, "id">): Policy {
  const id = String(nextId++);
  const full: Policy = { ...policy, id };
  policies.set(id, full);
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
  return policies.delete(id);
}

/** All active policies that cover a given address — what the monitor checks against on every event. */
export function findPoliciesCovering(address: Address): Policy[] {
  const target = address.toLowerCase();
  return listActivePolicies().filter((p) =>
    p.coveredAddresses.some((a) => a.toLowerCase() === target)
  );
}
