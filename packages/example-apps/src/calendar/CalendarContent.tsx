"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useApp, useDesktopContext, useTheme } from "@react-ui-os/desktop";
import {
  addEvent,
  CALENDAR_STORAGE_KEY,
  deleteEvent,
  listEvents,
  type CalendarEvent,
} from "./calendar-store";

// macOS Calendar Month view, modeled on the reference:
// - Today is marked with a filled red disc on the date number (white text).
//   https://support.apple.com/guide/calendar/symbols-used-in-calendar-symbls/mac
// - Days with events show the event titles (colored bars), or an indicator
//   when they overflow. The accent doubles as the single demo calendar color.
// - 6-row x 7-col grid covering the visible month, with leading/trailing days
//   from adjacent months shown muted. Weekday header above.
// First day of week defaults to Sunday (US convention); noted in the report.

const WEEKS = 6;
const DAYS_PER_WEEK = 7;

/** Local-time YYYY-MM-DD. Not toISOString, which is UTC and can shift the day. */
function dateKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The Sunday on or before the first day of the given month. */
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return start;
}

function ChevronLeft() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

interface DayCellData {
  date: Date;
  key: string;
  inMonth: boolean;
}

export function CalendarContent({ appId }: { appId: string }) {
  const { storage } = useDesktopContext();
  const theme = useTheme();
  const app = useApp(appId);
  const accent = app?.accent ?? theme.palette.accent;

  const today = new Date();
  const todayKey = dateKeyOf(today);

  // The month the grid is showing, identified by the 1st of that month.
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [events, setEvents] = useState<CalendarEvent[]>(() => listEvents(storage));
  const [newTitle, setNewTitle] = useState("");
  const addInputId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const focusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setEvents(listEvents(storage));
    };
    refresh();
    const unsubscribe = storage.subscribe((key) => {
      if (key === CALENDAR_STORAGE_KEY) refresh();
    });
    return unsubscribe;
  }, [storage]);

  // Move DOM focus to the selected cell after a keyboard move, so arrow-key
  // navigation keeps the roving focus on the grid.
  useEffect(() => {
    if (focusKeyRef.current === null) return;
    const target = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-day-key="${focusKeyRef.current}"]`,
    );
    target?.focus();
    focusKeyRef.current = null;
  }, [selectedKey, cursor]);

  const eventsByKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.dateKey);
      if (list) list.push(e);
      else map.set(e.dateKey, [e]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.createdAt - b.createdAt);
    }
    return map;
  }, [events]);

  const cells = useMemo<DayCellData[]>(() => {
    const start = gridStart(cursor.getFullYear(), cursor.getMonth());
    const out: DayCellData[] = [];
    for (let i = 0; i < WEEKS * DAYS_PER_WEEK; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      out.push({
        date,
        key: dateKeyOf(date),
        inMonth: date.getMonth() === cursor.getMonth(),
      });
    }
    return out;
  }, [cursor]);

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric",
      }).format(cursor),
    [cursor],
  );

  const weekdayNames = useMemo(() => {
    // A known Sunday (2024-01-07) plus 0..6 days gives Sun..Sat short labels.
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
    const sunday = new Date(2024, 0, 7);
    return Array.from({ length: DAYS_PER_WEEK }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return fmt.format(d);
    });
  }, []);

  const longDateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

  const goToMonth = useCallback((year: number, month: number) => {
    setCursor(new Date(year, month, 1));
  }, []);

  const prevMonth = useCallback(() => {
    goToMonth(cursor.getFullYear(), cursor.getMonth() - 1);
  }, [cursor, goToMonth]);

  const nextMonth = useCallback(() => {
    goToMonth(cursor.getFullYear(), cursor.getMonth() + 1);
  }, [cursor, goToMonth]);

  const goToday = useCallback(() => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(dateKeyOf(now));
  }, []);

  const selectDate = useCallback((date: Date) => {
    // Clicking a leading/trailing day from an adjacent month follows the cursor
    // into that month, matching macOS Calendar.
    setSelectedKey(dateKeyOf(date));
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
  }, []);

  // Arrow keys move the selection by 1 day / 1 week, like a real date grid.
  // Crossing a month boundary follows the cursor into the adjacent month.
  const onGridKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const deltas: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -DAYS_PER_WEEK,
        ArrowDown: DAYS_PER_WEEK,
      };
      const delta = deltas[e.key];
      if (delta !== undefined) {
        e.preventDefault();
        const base = new Date(`${selectedKey}T00:00:00`);
        base.setDate(base.getDate() + delta);
        focusKeyRef.current = dateKeyOf(base);
        setSelectedKey(dateKeyOf(base));
        setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
        return;
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        const base = new Date(`${selectedKey}T00:00:00`);
        base.setMonth(base.getMonth() - 1);
        focusKeyRef.current = dateKeyOf(base);
        setSelectedKey(dateKeyOf(base));
        setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
        return;
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        const base = new Date(`${selectedKey}T00:00:00`);
        base.setMonth(base.getMonth() + 1);
        focusKeyRef.current = dateKeyOf(base);
        setSelectedKey(dateKeyOf(base));
        setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        const base = new Date(`${selectedKey}T00:00:00`);
        base.setDate(base.getDate() - base.getDay());
        focusKeyRef.current = dateKeyOf(base);
        setSelectedKey(dateKeyOf(base));
        setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
      }
    },
    [selectedKey],
  );

  const selectedEvents = eventsByKey.get(selectedKey) ?? [];
  const selectedDate = new Date(`${selectedKey}T00:00:00`);

  const handleAdd = useCallback(() => {
    if (!newTitle.trim()) return;
    addEvent(storage, selectedKey, newTitle);
    setNewTitle("");
  }, [newTitle, selectedKey, storage]);

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    color: theme.palette.textPrimary,
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 14px",
    borderBottom: `1px solid ${theme.palette.border}`,
  };

  const navButton: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    padding: 0,
    border: `1px solid ${theme.palette.border}`,
    borderRadius: theme.shape.small,
    background: "transparent",
    color: theme.palette.textPrimary,
    cursor: "pointer",
  };

  const todayButton: CSSProperties = {
    height: 28,
    padding: "0 12px",
    border: `1px solid ${theme.palette.border}`,
    borderRadius: theme.shape.small,
    background: "transparent",
    color: theme.palette.textPrimary,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
    fontWeight: 500,
  };

  const weekdayRowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${DAYS_PER_WEEK}, 1fr)`,
    borderBottom: `1px solid ${theme.palette.border}`,
  };

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${DAYS_PER_WEEK}, 1fr)`,
    gridTemplateRows: `repeat(${WEEKS}, 1fr)`,
    flex: 1,
    minHeight: 0,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{monthTitle}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            aria-label="Previous month"
            onClick={prevMonth}
            style={navButton}
          >
            <ChevronLeft />
          </button>
          <button type="button" onClick={goToday} style={todayButton}>
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={nextMonth}
            style={navButton}
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      <div style={weekdayRowStyle}>
        {weekdayNames.map((name) => (
          <div
            key={name}
            aria-hidden
            style={{
              padding: "6px 0",
              textAlign: "center",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: theme.palette.textSecondary,
            }}
          >
            {name}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`${monthTitle}, month view`}
        onKeyDown={onGridKeyDown}
        style={gridStyle}
      >
        {cells.map((cell, i) => {
          const dayEvents = eventsByKey.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedKey;
          const col = i % DAYS_PER_WEEK;
          const row = Math.floor(i / DAYS_PER_WEEK);

          const label = `${longDateFmt.format(cell.date)}${
            dayEvents.length > 0
              ? `, ${String(dayEvents.length)} ${
                  dayEvents.length === 1 ? "event" : "events"
                }`
              : ", no events"
          }`;

          const cellStyle: CSSProperties = {
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 3,
            padding: "4px 5px 5px",
            minWidth: 0,
            border: "none",
            borderRight:
              col < DAYS_PER_WEEK - 1
                ? `1px solid ${theme.palette.border}`
                : "none",
            borderBottom:
              row < WEEKS - 1 ? `1px solid ${theme.palette.border}` : "none",
            background: isSelected ? `${accent}1f` : "transparent",
            outline: isSelected ? `1.5px solid ${accent}` : "none",
            outlineOffset: -1.5,
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            color: cell.inMonth
              ? theme.palette.textPrimary
              : theme.palette.textSecondary,
            opacity: cell.inMonth ? 1 : 0.55,
            overflow: "hidden",
          };

          const numberStyle: CSSProperties = {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "flex-end",
            minWidth: 22,
            height: 22,
            padding: "0 4px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: isToday ? 600 : 500,
            background: isToday ? accent : "transparent",
            color: isToday ? "#fff" : "inherit",
            flexShrink: 0,
          };

          return (
            <button
              type="button"
              key={cell.key}
              role="gridcell"
              data-day-key={cell.key}
              aria-label={label}
              aria-selected={isSelected}
              aria-current={isToday ? "date" : undefined}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectDate(cell.date)}
              style={cellStyle}
            >
              <span style={numberStyle}>{cell.date.getDate()}</span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                {dayEvents.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    title={ev.title}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      minWidth: 0,
                      fontSize: 11,
                      lineHeight: 1.3,
                      color: theme.palette.textPrimary,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: accent,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ev.title}
                    </span>
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: theme.palette.textSecondary,
                      paddingLeft: 10,
                    }}
                  >
                    {dayEvents.length - 3} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          borderTop: `1px solid ${theme.palette.border}`,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 200,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {longDateFmt.format(selectedDate)}
          </span>
          <span style={{ fontSize: 12, color: theme.palette.textSecondary }}>
            {selectedEvents.length === 0
              ? "No events"
              : `${selectedEvents.length} ${
                  selectedEvents.length === 1 ? "event" : "events"
                }`}
          </span>
        </div>

        <form
          style={{ display: "flex", alignItems: "center", gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          <label htmlFor={addInputId} style={{ position: "absolute", left: -9999 }}>
            New event on {longDateFmt.format(selectedDate)}
          </label>
          <input
            id={addInputId}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add an event"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontFamily: "inherit",
              color: theme.palette.textPrimary,
              background: "transparent",
              border: `1px solid ${theme.palette.border}`,
              borderRadius: theme.shape.small,
              outline: "none",
              padding: "6px 10px",
            }}
          />
          <button
            type="submit"
            aria-label="Add event"
            disabled={!newTitle.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              padding: 0,
              border: `1px solid ${theme.palette.border}`,
              borderRadius: theme.shape.small,
              background: "transparent",
              color: newTitle.trim() ? accent : theme.palette.textSecondary,
              cursor: newTitle.trim() ? "pointer" : "default",
              flexShrink: 0,
            }}
          >
            <PlusIcon />
          </button>
        </form>

        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {selectedEvents.length === 0 ? (
            <li
              style={{
                padding: "12px 0",
                fontSize: 12,
                color: theme.palette.textSecondary,
              }}
            >
              Nothing planned. Type above and press Return to add an event.
            </li>
          ) : (
            selectedEvents.map((ev) => (
              <li
                key={ev.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 0",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: accent,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={ev.title}
                >
                  {ev.title}
                </span>
                <button
                  type="button"
                  aria-label={`Delete event "${ev.title}"`}
                  onClick={() => deleteEvent(storage, ev.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 26,
                    height: 26,
                    padding: 0,
                    border: "none",
                    borderRadius: theme.shape.small,
                    background: "transparent",
                    color: theme.palette.textSecondary,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <TrashIcon />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
