"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { notify } from "@react-ui-os/core";
import { useTheme } from "@react-ui-os/desktop";
import { formatCountdown } from "./format";
import { ClockIcon } from "./icon";

/**
 * Timer tab modeled on the iOS Clock timer.
 *
 * iOS model: pick a duration with H/M/S wheels, Start. While running the
 * left control reads "Cancel" and the right reads "Pause"; while paused the
 * right reads "Resume". When the countdown hits zero the timer alerts.
 * Here the alert is a desktop notification via notify(...). The picker uses
 * +/- steppers in place of iOS's scroll wheels (the spec allows either).
 *
 * Countdown is computed from a target performance.now() deadline driven by
 * requestAnimationFrame, so it stays accurate and never accumulates the
 * drift a setInterval(1000) would.
 */

// iOS uses green start and red cancel on the timer; mirrored as the only
// two colored controls in the tab.
const START_GREEN = "#34c759";
const CANCEL_RED = "#ff3b30";

function nowMs(): number {
  const perf = globalThis.performance;
  if (typeof perf !== "undefined") return perf.now();
  return Date.now();
}

type Phase = "idle" | "running" | "paused";

interface Field {
  key: "h" | "m" | "s";
  label: string;
  max: number;
}

const FIELDS: Field[] = [
  { key: "h", label: "hours", max: 23 },
  { key: "m", label: "min", max: 59 },
  { key: "s", label: "sec", max: 59 },
];

export function Timer() {
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>("idle");
  const [h, setH] = useState(0);
  const [m, setM] = useState(5);
  const [s, setS] = useState(0);
  /** Remaining milliseconds, the live countdown source of truth. */
  const [remaining, setRemaining] = useState(0);

  const deadlineRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const pickedMs = (h * 3600 + m * 60 + s) * 1000;

  useEffect(() => {
    if (phase !== "running" || typeof window === "undefined") return;
    const loop = () => {
      const left = deadlineRef.current - nowMs();
      if (left <= 0) {
        setRemaining(0);
        setPhase("idle");
        if (!firedRef.current) {
          firedRef.current = true;
          notify({
            title: "Timer",
            body: "Time's up.",
            appId: "clock",
            accent: "#f97316",
            level: "info",
            icon: ClockIcon,
          });
        }
        return;
      }
      setRemaining(left);
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [phase]);

  const start = () => {
    if (pickedMs <= 0) return;
    firedRef.current = false;
    deadlineRef.current = nowMs() + pickedMs;
    setRemaining(pickedMs);
    setPhase("running");
  };

  const pause = () => {
    setRemaining(deadlineRef.current - nowMs());
    setPhase("paused");
  };

  const resume = () => {
    deadlineRef.current = nowMs() + remaining;
    setPhase("running");
  };

  const cancel = () => {
    setPhase("idle");
    setRemaining(0);
  };

  const setField = (key: Field["key"], value: number) => {
    if (key === "h") setH(value);
    else if (key === "m") setM(value);
    else setS(value);
  };
  const fieldValue = (key: Field["key"]) => (key === "h" ? h : key === "m" ? m : s);

  const idle = phase === "idle";

  const stepperButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: `1px solid ${theme.palette.border}`,
        background: theme.palette.surface,
        color: theme.palette.textPrimary,
        fontSize: 20,
        lineHeight: 1,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const pickerStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    padding: "28px 0",
  };

  const countdownStyle: CSSProperties = {
    fontSize: 64,
    fontWeight: 200,
    color: theme.palette.textPrimary,
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
    padding: "28px 0",
  };

  const controlsStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    padding: "0 24px 16px",
  };

  const circleButton = (
    label: string,
    onClick: () => void,
    tint: string,
    disabled = false,
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        border: `1px solid ${theme.palette.border}`,
        background: theme.palette.surface,
        color: tint,
        fontSize: 15,
        fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {idle ? (
        <div style={pickerStyle} role="group" aria-label="Timer duration">
          {FIELDS.map((field) => {
            const value = fieldValue(field.key);
            return (
              <div
                key={field.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {stepperButton("+", () =>
                  setField(field.key, value >= field.max ? 0 : value + 1),
                )}
                <span
                  aria-live="polite"
                  aria-label={`${String(value)} ${field.label}`}
                  style={{
                    fontSize: 34,
                    fontWeight: 300,
                    color: theme.palette.textPrimary,
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 44,
                    textAlign: "center",
                  }}
                >
                  {String(value).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 11, color: theme.palette.textSecondary }}>
                  {field.label}
                </span>
                {stepperButton("−", () =>
                  setField(field.key, value <= 0 ? field.max : value - 1),
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={countdownStyle} aria-live="polite">
          {formatCountdown(remaining)}
        </div>
      )}
      <div style={controlsStyle}>
        {idle
          ? circleButton("Cancel", cancel, theme.palette.textSecondary, true)
          : circleButton("Cancel", cancel, CANCEL_RED)}
        {idle &&
          circleButton("Start", start, START_GREEN, pickedMs <= 0)}
        {phase === "running" && circleButton("Pause", pause, theme.palette.textPrimary)}
        {phase === "paused" && circleButton("Resume", resume, START_GREEN)}
      </div>
    </div>
  );
}
