"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/useAuth";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`text-sm transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
    >
      {children}
    </Link>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Nav() {
  const { session, hydrated, loading, error, signIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="wrap flex items-center justify-between py-4">
        <Link href="/" className="font-display font-semibold text-lg text-fg tracking-[-0.01em]">
          Ripcord
        </Link>

        <nav className="flex items-center gap-7">
          <a href="/#how-it-works" className="text-sm text-muted hover:text-fg transition-colors hidden sm:inline">
            How it works
          </a>
          <a href="/#pricing" className="text-sm text-muted hover:text-fg transition-colors hidden sm:inline">
            Pricing
          </a>
          <NavLink href="/app">Get covered</NavLink>

          {hydrated && !session && (
            <button className="btn btn-primary !py-2 !px-4 !text-sm" onClick={signIn} disabled={loading}>
              {loading ? "Check your wallet…" : "Sign in"}
            </button>
          )}

          {hydrated && session && (
            <div className="relative">
              <button
                className="btn btn-secondary !py-2 !px-4 !text-sm font-mono"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                {shortAddress(session.address)}
              </button>

              {menuOpen && (
                <>
                  {/* Click-outside catcher */}
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 card !p-2 shadow">
                    <Link
                      href="/dashboard"
                      className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2 transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      My wallets
                    </Link>
                    <button
                      className="block w-full text-left rounded-md px-3 py-2 text-sm text-no-bg hover:bg-surface-2 transition-colors"
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </nav>
      </div>
      {error && (
        <div className="wrap pb-3">
          <p className="text-no-bg text-xs">{error}</p>
        </div>
      )}
    </header>
  );
}
