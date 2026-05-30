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
