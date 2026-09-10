import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-border">
      <div className="wrap flex items-center justify-between py-5">
        <Link href="/" className="font-display font-semibold text-lg text-fg">
          Ripcord
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted">
          <a href="/#how-it-works" className="hover:text-fg transition-colors">
            How it works
          </a>
          <a href="/#pricing" className="hover:text-fg transition-colors">
            Pricing
          </a>
          <Link href="/app" className="btn btn-primary !py-2 !px-4 !text-sm">
            Launch app
          </Link>
        </nav>
      </div>
    </header>
  );
}
