/**
 * SpeakCore Mark (Hexagon + stilisiertes „S") als Inline-SVG.
 * Geometrie/Farben gemäß branding/logos/. Keine Hooks → in Server- und Client-Komponenten nutzbar.
 */
export function BrandMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="SpeakCore">
      <defs>
        <linearGradient id="sc-mark-grad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path
        d="M32 5 L55.4 18.5 L55.4 45.5 L32 59 L8.6 45.5 L8.6 18.5 Z"
        fill="#111827"
        stroke="url(#sc-mark-grad)"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <text
        x="32"
        y="43"
        textAnchor="middle"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="30"
        fontWeight={700}
        fill="url(#sc-mark-grad)"
      >
        S
      </text>
    </svg>
  );
}
