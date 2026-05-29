"use client";

import type { ReactNode } from "react";

/**
 * Toolbar tool glyphs in the Lucide register (24x24, 1.8 stroke,
 * currentColor, no decorative fills). lucide-react is not a dependency,
 * so these are hand-written to match the same line weight as the app icon.
 */

interface IconProps {
  size?: number;
}

function frame(size: number, children: ReactNode) {
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
      {children}
    </svg>
  );
}

export function BrushIcon({ size = 18 }: IconProps) {
  return frame(
    size,
    <>
      <path d="M12 19l7-7a2.1 2.1 0 0 0-3-3l-7 7-1 4 4-1z" />
      <path d="M14 7l3 3" />
    </>,
  );
}

export function EraserIcon({ size = 18 }: IconProps) {
  return frame(
    size,
    <>
      <path d="M7 21h10" />
      <path d="M5 13l6-6 6 6-5 5H9z" />
      <path d="M11 7l6 6" />
    </>,
  );
}

export function UndoIcon({ size = 18 }: IconProps) {
  return frame(
    size,
    <>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
    </>,
  );
}

export function RedoIcon({ size = 18 }: IconProps) {
  return frame(
    size,
    <>
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H9a5 5 0 0 0 0 10h1" />
    </>,
  );
}

export function TrashIcon({ size = 18 }: IconProps) {
  return frame(
    size,
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>,
  );
}

export function DownloadIcon({ size = 18 }: IconProps) {
  return frame(
    size,
    <>
      <path d="M12 4v11" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 19h14" />
    </>,
  );
}
