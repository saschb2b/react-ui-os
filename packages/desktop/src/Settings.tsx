"use client";

import { useRef, useState } from "react";
import type {
  ColorFromPaletteField,
  CustomizableField,
  ImagePickField,
  RangeField,
  SelectField,
  SettingsPrefs,
  ToggleField,
} from "@react-ui-os/core";
import { getPath } from "@react-ui-os/core";
import { useSettings, useTheme } from "./desktop-context";
import { Slider, Toggle } from "./primitives";
import { useIsomorphicLayoutEffect } from "./util/use-isomorphic-layout-effect";

// Below this content width the sidebar would crowd the panel, so the category
// list folds up into a horizontal bar and the wide controls stack under their
// labels. Measured on the panel itself, not the viewport, because the Settings
// window resizes on its own.
const NARROW_WIDTH = 480;

/**
 * Settings system app body. Reads the active theme's `customizable` schema and
 * renders one editor per field. Layout follows modern settings apps (macOS
 * Ventura, Windows 11, GNOME): a search field over a category sidebar and a
 * content pane of grouped rows, each row a label and description beside its
 * control. Search filters across every section at once; below a width threshold
 * the sidebar folds into a top bar and wide controls stack under their labels.
 * Edits write straight to the prefs store, so the effective theme rebuilds live.
 */
export function Settings() {
  const theme = useTheme();
  const { schema, prefs, setPref, resetPref, resetAll } = useSettings();

  // Group the schema fields by section. The React Compiler memoizes the
  // result, so no useMemo is needed.
  const sections = new Map<string, Array<[string, CustomizableField]>>();
  for (const [path, field] of Object.entries(schema)) {
    const section = field.section ?? "General";
    const arr = sections.get(section) ?? [];
    arr.push([path, field]);
    sections.set(section, arr);
  }
  const grouped = Array.from(sections.entries());

  const hasPrefs = Object.keys(prefs).length > 0;
  const [active, setActive] = useState<string>(() => grouped[0]?.[0] ?? "");
  const [query, setQuery] = useState("");

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useIsomorphicLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // Measure once before paint so the first frame already picks the right
    // layout, then track resizes of the panel itself.
    setWidth(el.getBoundingClientRect().width);
    if (typeof window === "undefined" || typeof window.ResizeObserver === "undefined") {
      return;
    }
    const observer = new window.ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setWidth(w);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);
  const narrow = width > 0 && width < NARROW_WIDTH;

  if (grouped.length === 0) {
    return (
      <p
        style={{
          fontSize: 13,
          color: theme.palette.textSecondary,
          margin: 0,
        }}
      >
        The active theme exposes no customizable settings.
      </p>
    );
  }

  const activeEntry = grouped.find(([name]) => name === active) ??
    grouped[0] ?? ["", []];
  const [activeName, activeFields] = activeEntry;
  const categories = grouped.map(([name]) => name);

  // Search filters across every section at once (matching a field's label,
  // description, or its section name), the macOS / Windows reachability pattern:
  // type and the setting surfaces wherever it lives.
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matches: Array<[string, Array<[string, CustomizableField]>]> = searching
    ? grouped
        .map(
          ([name, fields]) =>
            [
              name,
              fields.filter(
                ([, field]) =>
                  field.label.toLowerCase().includes(q) ||
                  (field.description?.toLowerCase().includes(q) ?? false) ||
                  name.toLowerCase().includes(q),
              ),
            ] as [string, Array<[string, CustomizableField]>],
        )
        .filter(([, fields]) => fields.length > 0)
    : [];

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        color: theme.palette.textPrimary,
        minHeight: 300,
      }}
    >
      <SearchField value={query} onChange={setQuery} />

      {searching ? (
        matches.length === 0 ? (
          <p
            style={{
              fontSize: 13,
              color: theme.palette.textSecondary,
              margin: "4px 2px",
            }}
          >
            No settings match {`"${query}"`}.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {matches.map(([name, fields]) => (
              <section key={name}>
                <h3
                  style={{
                    margin: "0 0 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                    color: theme.palette.textSecondary,
                  }}
                >
                  {name}
                </h3>
                <FieldCard
                  fields={fields}
                  prefs={prefs}
                  narrow={narrow}
                  onSet={setPref}
                  onReset={resetPref}
                />
              </section>
            ))}
          </div>
        )
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: narrow ? "column" : "row",
            gap: narrow ? 12 : 18,
          }}
        >
          <CategoryNav
            categories={categories}
            activeName={activeName}
            onSelect={setActive}
            layout={narrow ? "bar" : "sidebar"}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <header
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                margin: "0 0 12px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16 }}>{activeName}</h2>
              {hasPrefs && (
                <button
                  type="button"
                  onClick={resetAll}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: theme.palette.textSecondary,
                    fontSize: 12,
                    padding: 0,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  Reset all
                </button>
              )}
            </header>
            <FieldCard
              fields={activeFields}
              prefs={prefs}
              narrow={narrow}
              onSet={setPref}
              onReset={resetPref}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <div style={{ position: "relative" }}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        aria-hidden
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: theme.palette.textSecondary,
        }}
      >
        <circle
          cx="7"
          cy="7"
          r="4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line
          x1="10.5"
          y1="10.5"
          x2="14"
          y2="14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        placeholder="Search settings"
        aria-label="Search settings"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 12px 8px 32px",
          border: `1px solid ${theme.palette.border}`,
          borderRadius: theme.shape.small,
          background: `${theme.palette.textPrimary}0d`,
          color: theme.palette.textPrimary,
          fontFamily: "inherit",
          fontSize: 13,
          outline: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = theme.palette.accent;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = theme.palette.border;
        }}
      />
    </div>
  );
}

function FieldCard({
  fields,
  prefs,
  narrow,
  onSet,
  onReset,
}: {
  fields: Array<[string, CustomizableField]>;
  prefs: SettingsPrefs;
  narrow: boolean;
  onSet: (path: string, value: unknown) => void;
  onReset: (path: string) => void;
}) {
  const theme = useTheme();
  return (
    <div
      style={{
        border: `1px solid ${theme.palette.border}`,
        borderRadius: theme.shape.small + 2,
        background: theme.palette.background,
        overflow: "hidden",
      }}
    >
      {fields.map(([path, field], i) => {
        const overridden = path in prefs;
        // Fall back to the effective theme (not the bare base) so a field that
        // the resolved appearance changes, like the wallpaper in dark mode,
        // shows its actual current value rather than the light default.
        const value = path in prefs ? prefs[path] : getPath(theme, path);
        return (
          <SettingRow
            key={path}
            field={field}
            value={value}
            overridden={overridden}
            isLast={i === fields.length - 1}
            narrow={narrow}
            onChange={(v) => {
              onSet(path, v);
            }}
            onReset={() => {
              onReset(path);
            }}
          />
        );
      })}
    </div>
  );
}

function CategoryNav({
  categories,
  activeName,
  onSelect,
  layout,
}: {
  categories: string[];
  activeName: string;
  onSelect: (name: string) => void;
  layout: "sidebar" | "bar";
}) {
  const theme = useTheme();
  const bar = layout === "bar";
  return (
    <nav
      aria-label="Settings categories"
      style={{
        display: "flex",
        flexShrink: 0,
        flexDirection: bar ? "row" : "column",
        gap: bar ? 6 : 2,
        ...(bar
          ? {
              overflowX: "auto",
              borderBottom: `1px solid ${theme.palette.border}`,
              paddingBottom: 10,
            }
          : {
              width: 150,
              borderRight: `1px solid ${theme.palette.border}`,
              paddingRight: 12,
            }),
      }}
    >
      {categories.map((name, index) => {
        const isActive = name === activeName;
        return (
          <button
            key={name}
            type="button"
            aria-current={isActive}
            // Roving tabindex: Tab lands on the selected category, then the
            // arrow keys move along the list (vertical sidebar / horizontal
            // bar), the way a macOS or Windows settings sidebar navigates.
            tabIndex={isActive ? 0 : -1}
            onClick={() => {
              onSelect(name);
            }}
            onKeyDown={(e) => {
              const nextKey = bar ? "ArrowRight" : "ArrowDown";
              const prevKey = bar ? "ArrowLeft" : "ArrowUp";
              let target = -1;
              if (e.key === nextKey) target = (index + 1) % categories.length;
              else if (e.key === prevKey)
                target = (index - 1 + categories.length) % categories.length;
              else if (e.key === "Home") target = 0;
              else if (e.key === "End") target = categories.length - 1;
              else return;
              e.preventDefault();
              const targetName = categories[target];
              if (targetName !== undefined) onSelect(targetName);
              const buttons =
                e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                  "button",
                );
              buttons?.[target]?.focus();
            }}
            style={{
              appearance: "none",
              border: 0,
              textAlign: bar ? "center" : "left",
              whiteSpace: "nowrap",
              flexShrink: 0,
              padding: bar ? "6px 14px" : "7px 10px",
              borderRadius: theme.shape.small,
              background: isActive ? `${theme.palette.accent}30` : "transparent",
              color: isActive ? theme.palette.textPrimary : theme.palette.textSecondary,
              fontWeight: isActive ? 600 : 500,
              fontSize: 13,
              fontFamily: "inherit",
              cursor: "pointer",
              transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
            }}
            onMouseEnter={(e) => {
              if (!isActive)
                e.currentTarget.style.background = `${theme.palette.textPrimary}12`;
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            {name}
          </button>
        );
      })}
    </nav>
  );
}

interface SettingRowProps {
  field: CustomizableField;
  value: unknown;
  overridden: boolean;
  isLast: boolean;
  narrow: boolean;
  onChange: (value: unknown) => void;
  onReset: () => void;
}

function SettingRow({
  field,
  value,
  overridden,
  isLast,
  narrow,
  onChange,
  onReset,
}: SettingRowProps) {
  const theme = useTheme();
  // Wide controls read better stacked under the label, the macOS / Windows /
  // GNOME row pattern. On a narrow panel everything but a toggle stacks too, so
  // the description keeps its width instead of being squeezed beside the control.
  const stacked = field.kind === "image-pick" || (narrow && field.kind !== "toggle");
  const control = <FieldControl field={field} value={value} onChange={onChange} />;
  // A slider fills the row when stacked under its label; inline it is capped so
  // it doesn't dominate the row.
  const controlNode =
    field.kind === "range" ? (
      <div style={{ width: stacked ? "100%" : 180 }}>{control}</div>
    ) : (
      control
    );
  const reset = overridden ? (
    <button
      type="button"
      onClick={onReset}
      style={{
        border: 0,
        background: "transparent",
        color: theme.palette.textSecondary,
        fontSize: 11,
        cursor: "pointer",
        padding: 0,
        fontFamily: "inherit",
      }}
    >
      Reset
    </button>
  ) : null;

  const labelBlock = (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{field.label}</div>
      {field.description && (
        <div
          style={{
            fontSize: 11,
            color: theme.palette.textSecondary,
            marginTop: 2,
          }}
        >
          {field.description}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        padding: "12px 14px",
        borderBottom: isLast ? "none" : `1px solid ${theme.palette.border}`,
        display: "flex",
        flexDirection: stacked ? "column" : "row",
        alignItems: stacked ? "stretch" : "center",
        justifyContent: "space-between",
        gap: stacked ? 10 : 16,
      }}
    >
      {stacked ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            {labelBlock}
            {reset}
          </div>
          {controlNode}
        </>
      ) : (
        <>
          {labelBlock}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            {reset}
            {controlNode}
          </div>
        </>
      )}
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: CustomizableField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.kind) {
    case "color-from-palette":
      return (
        <ColorFromPaletteControl
          field={field}
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
        />
      );
    case "image-pick":
      return (
        <ImagePickControl
          field={field}
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
        />
      );
    case "range":
      return (
        <RangeControl
          field={field}
          value={typeof value === "number" ? value : field.min}
          onChange={onChange}
        />
      );
    case "select":
      return (
        <SelectControl
          field={field}
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
        />
      );
    case "toggle":
      return <ToggleControl field={field} value={Boolean(value)} onChange={onChange} />;
  }
}

function ColorFromPaletteControl({
  field,
  value,
  onChange,
}: {
  field: ColorFromPaletteField;
  value: string | undefined;
  onChange: (value: unknown) => void;
}) {
  const theme = useTheme();
  return (
    <div
      role="group"
      aria-label={field.label}
      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
    >
      {field.options.map((color) => {
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => {
              onChange(color);
            }}
            aria-label={color}
            aria-pressed={selected}
            style={{
              width: 28,
              height: 28,
              borderRadius: theme.shape.small,
              border: selected
                ? `2px solid ${theme.palette.textPrimary}`
                : `1px solid ${theme.palette.border}`,
              background: color,
              cursor: "pointer",
              padding: 0,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          />
        );
      })}
    </div>
  );
}

function ImagePickControl({
  field,
  value,
  onChange,
}: {
  field: ImagePickField;
  value: string | undefined;
  onChange: (value: unknown) => void;
}) {
  const theme = useTheme();
  return (
    <div
      role="group"
      aria-label={field.label}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
        gap: 8,
      }}
    >
      {field.options.map((opt) => {
        const selected = value === opt.src;
        return (
          <button
            key={opt.src}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onChange(opt.src);
            }}
            style={{
              padding: 4,
              border: selected
                ? `2px solid ${theme.palette.accent}`
                : `1px solid ${theme.palette.border}`,
              borderRadius: theme.shape.small + 2,
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              alignItems: "center",
            }}
          >
            <img
              src={opt.src}
              alt={opt.label}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                aspectRatio: "16 / 10",
                objectFit: "cover",
                borderRadius: theme.shape.small,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: theme.palette.textSecondary,
              }}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RangeControl({
  field,
  value,
  onChange,
}: {
  field: RangeField;
  value: number;
  onChange: (value: unknown) => void;
}) {
  return (
    <Slider
      value={value}
      min={field.min}
      max={field.max}
      step={field.step}
      onChange={(v) => onChange(v)}
      unit={field.unit}
      ariaLabel={field.label}
    />
  );
}

function SelectControl({
  field,
  value,
  onChange,
}: {
  field: SelectField;
  value: string | undefined;
  onChange: (value: unknown) => void;
}) {
  const theme = useTheme();
  return (
    <div
      role="group"
      aria-label={field.label}
      style={{
        display: "inline-flex",
        border: `1px solid ${theme.palette.border}`,
        borderRadius: theme.shape.small,
        overflow: "hidden",
      }}
    >
      {field.options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onChange(opt.value);
            }}
            style={{
              border: "none",
              background: selected ? `${theme.palette.accent}38` : "transparent",
              color: theme.palette.textPrimary,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleControl({
  field,
  value,
  onChange,
}: {
  field: ToggleField;
  value: boolean;
  onChange: (value: unknown) => void;
}) {
  return (
    <Toggle
      checked={value}
      onChange={(next) => onChange(next)}
      ariaLabel={field.label}
    />
  );
}
