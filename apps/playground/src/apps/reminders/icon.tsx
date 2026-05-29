"use client";

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
