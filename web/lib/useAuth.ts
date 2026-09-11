"use client";

import { useCallback, useEffect, useState } from "react";
import { loadSession, signInWithMetaMask, signOut as doSignOut, type Session } from "./auth";

/** Shared auth state — Nav's account menu and the dashboard both need this, and both need to
 * react to sign-in/out happening in the other, so it's one hook rather than each component
 * reading localStorage independently and drifting out of sync. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);

  const signIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await signInWithMetaMask();
      setSession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await doSignOut();
    setSession(null);
  }, []);

  return { session, hydrated, loading, error, signIn, signOut };
}
