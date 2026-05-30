"use client";

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
