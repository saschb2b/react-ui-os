"use client";

import { useRef, type CSSProperties } from "react";
import { useTheme } from "../desktop-context";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  /** Optional label rendered above the track. */
  label?: string;
  /** Optional unit appended to the value readout (`"px"`, `"ms"`, `"%"`). */
  unit?: string;
  /** Override the accent. Defaults to the theme accent. */
  accent?: string;
  /** Hide the right-aligned numeric readout. */
  hideValue?: boolean;
  /** Disable interaction. */
  disabled?: boolean;
  /** Accessibility label when no visible `label`. */
  ariaLabel?: string;
}

/**
 * Themed range input. Renders the native input invisibly above the
 * track so keyboard and pointer behavior stay correct (Tab focus, arrow
 * keys, screen-reader announcements) while the visual fill, thumb, and
 * readout are styled to match the rest of the library.
 *
 * Why not a custom-drawn track + a fake thumb? The native input handles
 * page-up / page-down / home / end shortcuts and screen-reader value
 * announcements for free. A custom implementation would have to redo
 * all of that and still wouldn't be as good.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  unit,
  accent,
  hideValue = false,
  disabled = false,
  ariaLabel,
}: SliderProps) {
  const theme = useTheme();
  const accentColor = accent ?? theme.palette.accent;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  const trackBg = `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${String(pct)}%, ${theme.palette.border} ${String(pct)}%, ${theme.palette.border} 100%)`;

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    opacity: disabled ? 0.5 : 1,
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    fontSize: 12,
    color: theme.palette.textSecondary,
    fontVariantNumeric: "tabular-nums",
  };

  const trackHeight = 4;
  const thumbSize = 16;

  const wrapperStyle: CSSProperties = {
    position: "relative",
    height: thumbSize,
    display: "flex",
    alignItems: "center",
  };

  const trackStyle: CSSProperties = {
    position: "absolute",
    inset: `${String(Math.floor((thumbSize - trackHeight) / 2))}px 0`,
    borderRadius: trackHeight,
    background: trackBg,
    pointerEvents: "none",
  };

  const inputStyle: CSSProperties = {
    appearance: "none",
    WebkitAppearance: "none",
    width: "100%",
    height: thumbSize,
    background: "transparent",
    margin: 0,
    padding: 0,
    cursor: disabled ? "not-allowed" : "pointer",
    // The track span is absolutely positioned and precedes the input in the
    // DOM, so without this the track would paint over the (statically
    // positioned) input and cross through its thumb. Lift the input above it.
    position: "relative",
    zIndex: 1,
  };

  return (
    <div style={containerStyle}>
      {(label || !hideValue) && (
        <div style={headerStyle}>
          {label ? (
            <span style={{ color: theme.palette.textPrimary }}>{label}</span>
          ) : (
            <span />
          )}
          {!hideValue && (
            <span>
              {String(value)}
              {unit ? ` ${unit}` : ""}
            </span>
          )}
        </div>
      )}
      <div style={wrapperStyle}>
        <span style={trackStyle} aria-hidden />
        <input
          ref={inputRef}
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            onChange(Number(e.target.value));
          }}
          aria-label={ariaLabel ?? label}
          aria-valuetext={`${String(value)}${unit ? ` ${unit}` : ""}`}
          style={inputStyle}
          className="rui-slider-input"
        />
      </div>
      <style>
        {`
          .rui-slider-input::-webkit-slider-runnable-track {
            height: ${String(trackHeight)}px;
            background: transparent;
            border-radius: ${String(trackHeight)}px;
          }
          .rui-slider-input::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: ${String(thumbSize)}px;
            height: ${String(thumbSize)}px;
            border-radius: 50%;
            background: #fff;
            border: 1px solid rgba(0,0,0,0.15);
            box-shadow: 0 1px 3px rgba(0,0,0,0.35);
            margin-top: ${String(-(thumbSize - trackHeight) / 2)}px;
            cursor: ${disabled ? "not-allowed" : "pointer"};
            transition: transform 100ms ease;
          }
          .rui-slider-input:active::-webkit-slider-thumb {
            transform: scale(1.1);
          }
          .rui-slider-input::-moz-range-track {
            height: ${String(trackHeight)}px;
            background: transparent;
          }
          .rui-slider-input::-moz-range-thumb {
            width: ${String(thumbSize - 2)}px;
            height: ${String(thumbSize - 2)}px;
            border-radius: 50%;
            background: #fff;
            border: 1px solid rgba(0,0,0,0.15);
            box-shadow: 0 1px 3px rgba(0,0,0,0.35);
            cursor: ${disabled ? "not-allowed" : "pointer"};
          }
          .rui-slider-input:focus-visible::-webkit-slider-thumb {
            box-shadow: 0 0 0 3px ${accentColor}66, 0 1px 3px rgba(0,0,0,0.35);
          }
          .rui-slider-input:focus-visible::-moz-range-thumb {
            box-shadow: 0 0 0 3px ${accentColor}66, 0 1px 3px rgba(0,0,0,0.35);
          }
        `}
      </style>
    </div>
  );
}
