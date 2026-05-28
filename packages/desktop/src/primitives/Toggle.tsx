"use client";

import type { CSSProperties } from "react";
import { useTheme } from "../desktop-context";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Visible label rendered to the left of the switch. */
  label?: string;
  /** Optional helper line under the label. */
  description?: string;
  /** Accent color override (defaults to the theme accent). */
  accent?: string;
  /** Disable interaction. */
  disabled?: boolean;
  /** Accessibility label when no visible `label` is provided. */
  ariaLabel?: string;
}

/**
 * Themed switch. Renders a labelled row with a sliding thumb track —
 * macOS-style. Built on a real `<button role="switch">` so screen
 * readers and keyboard users get the right semantics and focus ring.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  accent,
  disabled = false,
  ariaLabel,
}: ToggleProps) {
  const theme = useTheme();
  const accentColor = accent ?? theme.palette.accent;

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    opacity: disabled ? 0.55 : 1,
  };

  const labelBlockStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  };

  const switchStyle: CSSProperties = {
    appearance: "none",
    position: "relative",
    width: 34,
    height: 20,
    borderRadius: 999,
    border: `1px solid ${checked ? accentColor : theme.palette.border}`,
    background: checked ? accentColor : theme.palette.border,
    cursor: disabled ? "not-allowed" : "pointer",
    padding: 0,
    transition: "background 140ms ease, border-color 140ms ease",
    flexShrink: 0,
  };

  const thumbStyle: CSSProperties = {
    position: "absolute",
    top: 1,
    left: checked ? 15 : 1,
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
    transition: "left 140ms cubic-bezier(0.2, 0.85, 0.25, 1)",
  };

  return (
    <div style={rowStyle}>
      {(label || description) && (
        <div style={labelBlockStyle}>
          {label && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: theme.palette.textPrimary,
              }}
            >
              {label}
            </span>
          )}
          {description && (
            <span style={{ fontSize: 11, color: theme.palette.textSecondary }}>
              {description}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={switchStyle}
      >
        <span aria-hidden style={thumbStyle} />
      </button>
    </div>
  );
}
