/** The Ripcord mark — a plain circle, single color. Used in the nav next to the wordmark and as
 * the browser-tab favicon (app/icon.svg — keep that file's fill in sync if this one ever changes).
 * Takes `style` too, not just `className`, so the media kit can force a fixed color per swatch
 * (on-dark/on-light lockups need to show both regardless of the viewer's own theme). */
export function BrandMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" className={className} style={style} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="currentColor" />
    </svg>
  );
}
