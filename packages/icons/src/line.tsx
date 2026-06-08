/**
 * Line (macOS / generic) app glyphs: original Lucide-style stroke icons, no
 * decorative fills. Used as the default `icon` and under non-Fluent themes.
 * Original artwork for this library (no vendor paths reproduced).
 */

import type { JSX } from "react";

/** Lucide-style notepad glyph. Stroke only, no decorative fills. */
export function NotesIcon({ size = 24 }: { size?: number }): JSX.Element {
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
      <path d="M5 3.5h11a2 2 0 0 1 2 2V18a2.5 2.5 0 0 1-2.5 2.5H6.5A1.5 1.5 0 0 1 5 19V3.5Z" />
      <path d="M5 7.5H2.6M5 12H2.6M5 16.5H2.6" />
      <path d="M9 8.5h6M9 12h6M9 15.5h4" />
    </svg>
  );
}

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

/** Lucide-style clock glyph. Stroke only, no decorative fills. */
export function ClockIcon({ size = 24 }: { size?: number }): JSX.Element {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

("use client");

/** Lucide-style calendar glyph: a page with a header bar and two hanging rings. */
export function CalendarIcon({ size = 24 }: { size?: number }) {
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
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
    </svg>
  );
}

("use client");

/** Lucide-style checklist glyph: two ticked rows plus a third line item. */
export function RemindersIcon({ size = 24 }: { size?: number }) {
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
      aria-hidden
    >
      <path d="m3 5 2 2 3-3" />
      <path d="m3 13 2 2 3-3" />
      <path d="M12 6h9" />
      <path d="M12 14h9" />
      <path d="M3 21h18" />
    </svg>
  );
}

("use client");

/**
 * Pencil glyph for the Sketch app, drawn in the Lucide register
 * (24x24 viewBox, 1.8 stroke, currentColor, no fills) so it tints to
 * the app accent on the dock tile and to text color in chrome.
 */
export function SketchIcon({ size = 24 }: { size?: number }) {
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
      aria-hidden
    >
      <path d="M12 19l7-7a2.1 2.1 0 0 0-3-3l-7 7-1 4 4-1z" />
      <path d="M14 7l3 3" />
      <path d="M5 19h4" />
    </svg>
  );
}

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
