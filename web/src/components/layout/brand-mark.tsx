/** Three ruled bars: a quiet chart glyph in the site's three data colours. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="7" y="15" width="4.5" height="10" fill="var(--teal)" />
      <rect x="13.75" y="9" width="4.5" height="16" fill="var(--terracotta)" />
      <rect x="20.5" y="12" width="4.5" height="13" fill="var(--ochre)" />
    </svg>
  )
}
