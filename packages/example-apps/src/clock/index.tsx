"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { App } from "@react-ui-os/core";
import { useTheme } from "@react-ui-os/desktop";
import { ClockIcon } from "./icon";
import { WorldClock } from "./WorldClock";
import { Stopwatch } from "./Stopwatch";
import { Timer } from "./Timer";

const ACCENT = "#f97316";

type TabId = "world" | "stopwatch" | "timer";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "world", label: "World Clock" },
  { id: "stopwatch", label: "Stopwatch" },
  { id: "timer", label: "Timer" },
];

function ClockContent() {
  const theme = useTheme();
  const [active, setActive] = useState<TabId>("world");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Roving arrow-key navigation across the tablist, per WAI-ARIA tabs.
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    const target = TABS[next];
    if (target) {
      setActive(target.id);
      tabRefs.current[next]?.focus();
    }
  };

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    color: theme.palette.textPrimary,
  };

  const tabListStyle: CSSProperties = {
    display: "flex",
    gap: 4,
    padding: 4,
    margin: "12px 16px",
    background: theme.palette.border,
    borderRadius: theme.shape.small,
  };

  const tabStyle = (selected: boolean): CSSProperties => ({
    flex: 1,
    padding: "6px 0",
    fontSize: 13,
    fontWeight: selected ? 600 : 400,
    fontFamily: "inherit",
    border: "none",
    borderRadius: theme.shape.small,
    cursor: "pointer",
    color: selected ? theme.palette.textPrimary : theme.palette.textSecondary,
    // iOS segmented control: the selected segment is a filled surface pill,
    // not an accent stripe. The fill is the indicator.
    background: selected ? theme.palette.surface : "transparent",
    transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ${theme.motion.windowOpenEasing}`,
    boxShadow: selected ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
    outlineOffset: 2,
  });

  return (
    <div style={containerStyle}>
      <div role="tablist" aria-label="Clock modes" style={tabListStyle}>
        {TABS.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`clock-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`clock-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setActive(tab.id);
              }}
              onKeyDown={(event) => {
                onTabKeyDown(event, index);
              }}
              style={tabStyle(selected)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`clock-panel-${active}`}
        aria-labelledby={`clock-tab-${active}`}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        {active === "world" && <WorldClock />}
        {active === "stopwatch" && <Stopwatch />}
        {active === "timer" && <Timer />}
      </div>
    </div>
  );
}

export const clockApp: App = {
  id: "clock",
  name: "Clock",
  tagline: "World clock, stopwatch, timer",
  accent: ACCENT,
  icon: ClockIcon,
  defaultBounds: { w: 380, h: 520 },
  content: ClockContent,
};
