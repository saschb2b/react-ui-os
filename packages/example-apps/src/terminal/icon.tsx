import type { JSX } from "react";

/**
 * Lucide-style terminal glyph: a rounded window with a ">" prompt chevron
 * and a command line beside it. Stroke-only, inherits color so the dock and
 * menu bar can tint it with the app accent.
 */
export function TerminalIcon({ size = 24 }: { size?: number }): JSX.Element {
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
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7 9.5 10 12l-3 2.5" />
      <line x1="12.5" y1="15" x2="16.5" y2="15" />
    </svg>
  );
}
