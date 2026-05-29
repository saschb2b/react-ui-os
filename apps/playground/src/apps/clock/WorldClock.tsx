"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "@react-ui-os/desktop";

/**
 * World Clock tab. Mirrors the iOS Clock app: each row shows a city, its
 * live local time, a day label relative to the user's own day
 * ("Today" / "Yesterday" / "Tomorrow"), and the whole-hour offset from
 * local ("+0HRS" / "+8HRS" / "-5HRS").
 *
 * Reference: Apple Support, "See the world clock in Clock on iPhone"
 * (support.apple.com/guide/iphone/see-the-world-clock-iph1ac0b4af/ios):
 * local-zone cities read +0HRS, others show how far ahead/behind they are,
 * with Today/Yesterday/Tomorrow telling you whether the calendar date there
 * matches yours.
 *
 * A small fixed city list is intentional (scope-bounded; no add/remove).
 */

interface City {
  name: string;
  /** IANA time-zone id passed to Intl.DateTimeFormat. */
  timeZone: string;
}

const CITIES: City[] = [
  { name: "Cupertino", timeZone: "America/Los_Angeles" },
  { name: "New York", timeZone: "America/New_York" },
  { name: "London", timeZone: "Europe/London" },
  { name: "Tokyo", timeZone: "Asia/Tokyo" },
  { name: "Sydney", timeZone: "Australia/Sydney" },
];

/**
 * Wall-clock fields for a given instant in a given zone, read out of
 * Intl rather than computed from a raw UTC offset (so DST is handled by
 * the platform's tz database).
 */
function zoneParts(date: Date, timeZone: string): {
  hour: number;
  minute: number;
  /** Day-of-month, used only to compare calendar dates across zones. */
  ymd: string;
  /** Ready-to-render "9:41 AM" style time. */
  label: string;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const label = dtf.format(date);

  const numeric = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of numeric.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  // "24" can surface at midnight under hour12:false; normalize to 0.
  const rawHour = Number(map.hour);
  return {
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(map.minute),
    ymd: `${map.year ?? ""}-${map.month ?? ""}-${map.day ?? ""}`,
    label,
  };
}

/** Whole-hour offset of `timeZone` from the local zone at `date`. */
function hourOffset(date: Date, timeZone: string, localZone: string): number {
  const local = zoneParts(date, localZone);
  const there = zoneParts(date, timeZone);
  const localMinutes = local.hour * 60 + local.minute;
  let thereMinutes = there.hour * 60 + there.minute;
  // Account for the date rolling across zones so a -16h reading is not
  // mistaken for +8h. Compare calendar dates and shift a full day.
  if (there.ymd > local.ymd) thereMinutes += 24 * 60;
  else if (there.ymd < local.ymd) thereMinutes -= 24 * 60;
  return Math.round((thereMinutes - localMinutes) / 60);
}

/** "Today" / "Tomorrow" / "Yesterday" for a zone relative to local. */
function dayLabel(date: Date, timeZone: string, localZone: string): string {
  const local = zoneParts(date, localZone).ymd;
  const there = zoneParts(date, timeZone).ymd;
  if (there > local) return "Tomorrow";
  if (there < local) return "Yesterday";
  return "Today";
}

function localZone(): string {
  if (typeof Intl === "undefined") return "UTC";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function WorldClock() {
  const theme = useTheme();
  const [now, setNow] = useState<Date>(() => new Date());

  // Tick once a second. The visible time only changes by the minute, but a
  // 1s cadence keeps the offset/day flips prompt without busy-waiting.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const zone = localZone();

  const listStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    flex: 1,
  };

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: `1px solid ${theme.palette.border}`,
  };

  return (
    <div style={listStyle}>
      {CITIES.map((city) => {
        const parts = zoneParts(now, city.timeZone);
        const offset = hourOffset(now, city.timeZone, zone);
        const day = dayLabel(now, city.timeZone, zone);
        const sign = offset > 0 ? "+" : offset < 0 ? "-" : "+";
        const offsetText = `${sign}${String(Math.abs(offset))}HRS`;
        return (
          <div key={city.timeZone} style={rowStyle}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontSize: 12,
                  color: theme.palette.textSecondary,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {day}, {offsetText}
              </span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 400,
                  color: theme.palette.textPrimary,
                }}
              >
                {city.name}
              </span>
            </div>
            <span
              style={{
                fontSize: 30,
                fontWeight: 300,
                color: theme.palette.textPrimary,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {parts.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
