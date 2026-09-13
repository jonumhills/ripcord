import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="wrap py-10 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>Ripcord — parametric wallet insurance.</span>
        <div className="flex items-center gap-4">
          <Link href="/media-kit" className="hover:text-fg transition-colors">
            Media kit
          </Link>
          <span>Built for ETHGlobal Online. Not audited. Testnet only.</span>
        </div>
      </div>
    </footer>
  );
}
