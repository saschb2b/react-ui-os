"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTheme } from "@react-ui-os/desktop";
import { formatStopwatch } from "./format";

/**
 * Stopwatch tab modeled on the iOS Clock stopwatch.
 *
 * iOS button model: while stopped the left button reads "Reset" (disabled
 * at zero) and the right reads "Start"/"Resume"; while running the left
 * reads "Lap" and the right reads "Stop". Laps list newest-first, each row
 * showing the per-lap time. After three or more laps iOS marks the fastest
 * lap green and the slowest red.
 * Reference: Apple Support "Time events with a stopwatch"
 * (support.apple.com/guide/watch/stopwatch-apd0d5883fca/watchos): fastest
 * lap green, slowest lap red once 3+ laps exist; each lap records both its
 * own time and the running split.
 *
 * Timing uses performance.now() accumulated across start/stop spans, so
 * pausing never loses or double-counts elapsed time, and the readout is
 * driven by requestAnimationFrame rather than an interval that would drift.
 */

// iOS shows green start and red stop on the stopwatch; we mirror those two
// semantic states. These are the only colored controls in the tab.
const START_GREEN = "#34c759";
const STOP_RED = "#ff3b30";

function nowMs(): number {
  const perf = globalThis.performance;
  if (typeof perf !== "undefined") return perf.now();
  return Date.now();
}

export function Stopwatch() {
  const theme = useTheme();
  const [running, setRunning] = useState(false);
  /** Total elapsed across all run spans, frozen on stop. */
  const [elapsed, setElapsed] = useState(0);
  /** Cumulative split time at each recorded lap, oldest first. */
  const [lapSplits, setLapSplits] = useState<number[]>([]);

  const startStampRef = useRef(0);
  const baseRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running || typeof window === "undefined") return;
    const loop = () => {
      setElapsed(baseRef.current + (nowMs() - startStampRef.current));
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [running]);

  const start = () => {
    baseRef.current = elapsed;
    startStampRef.current = nowMs();
    setRunning(true);
  };

  const stop = () => {
    setElapsed(baseRef.current + (nowMs() - startStampRef.current));
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setLapSplits([]);
    baseRef.current = 0;
  };

  const lap = () => {
    setLapSplits((prev) => [...prev, elapsed]);
  };

  // Per-lap durations from the cumulative splits, plus the in-progress lap
  // as the topmost row while running (iOS shows the live current lap).
  const lapTimes: number[] = [];
  for (let i = 0; i < lapSplits.length; i += 1) {
    lapTimes.push((lapSplits[i] ?? 0) - (lapSplits[i - 1] ?? 0));
  }
  const completedCount = lapSplits.length;
  const currentLap = elapsed - (lapSplits[lapSplits.length - 1] ?? 0);

  // Fastest / slowest only meaningful, and only highlighted, once iOS's
  // three-lap threshold is met. Compare completed laps only.
  let fastestIdx = -1;
  let slowestIdx = -1;
  if (completedCount >= 3) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < lapTimes.length; i += 1) {
      const t = lapTimes[i] ?? 0;
      if (t < min) {
        min = t;
        fastestIdx = i;
      }
      if (t > max) {
        max = t;
        slowestIdx = i;
      }
    }
  }

  const displayStyle: CSSProperties = {
    fontSize: 64,
    fontWeight: 200,
    color: theme.palette.textPrimary,
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
    padding: "24px 0",
    letterSpacing: "0.01em",
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

  const lapRowStyle = (highlight: string | null): CSSProperties => ({
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 24px",
    borderTop: `1px solid ${theme.palette.border}`,
    fontVariantNumeric: "tabular-nums",
    fontSize: 14,
    color: highlight ?? theme.palette.textPrimary,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={displayStyle} aria-live="off">
        {formatStopwatch(elapsed)}
      </div>
      <div style={controlsStyle}>
        {running
          ? circleButton("Lap", lap, theme.palette.textPrimary)
          : circleButton("Reset", reset, theme.palette.textPrimary, elapsed === 0)}
        {running
          ? circleButton("Stop", stop, STOP_RED)
          : circleButton(elapsed === 0 ? "Start" : "Resume", start, START_GREEN)}
      </div>
      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {running && (
          <div style={lapRowStyle(null)}>
            <span>Lap {completedCount + 1}</span>
            <span>{formatStopwatch(currentLap)}</span>
          </div>
        )}
        {lapTimes
          .map((t, i) => ({ t, i }))
          .reverse()
          .map(({ t, i }) => {
            const highlight =
              i === fastestIdx ? START_GREEN : i === slowestIdx ? STOP_RED : null;
            return (
              <div key={i} style={lapRowStyle(highlight)}>
                <span>Lap {i + 1}</span>
                <span>{formatStopwatch(t)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
