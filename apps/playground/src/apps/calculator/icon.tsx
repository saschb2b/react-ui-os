import type { JSX } from "react";

/**
 * Lucide-style calculator glyph: a rounded body, a display bar across the
 * top, and a 2x2 grid of keys. Stroke-only, inherits color so the dock and
 * menu bar can tint it with the app accent.
 */
export function CalculatorIcon({ size = 24 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <line x1="8" y1="6.5" x2="16" y2="6.5" />
      <line x1="8.5" y1="11" x2="8.5" y2="11" />
      <line x1="12" y1="11" x2="12" y2="11" />
      <line x1="15.5" y1="11" x2="15.5" y2="11" />
      <line x1="8.5" y1="14.5" x2="8.5" y2="14.5" />
      <line x1="12" y1="14.5" x2="12" y2="14.5" />
      <line x1="15.5" y1="14.5" x2="15.5" y2="14.5" />
      <line x1="8.5" y1="18" x2="8.5" y2="18" />
      <line x1="12" y1="18" x2="12" y2="18" />
      <line x1="15.5" y1="18" x2="15.5" y2="18" />
    </svg>
  );
}
