/** The Ripcord mark — a plain circle, single color. Used in the nav next to the wordmark and as
 * the browser-tab favicon (app/icon.svg — keep that file's fill in sync if this one ever changes). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="currentColor" />
    </svg>
  );
}
