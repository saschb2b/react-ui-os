"use client";

import { useState } from "react";
import type {
  ColorFromPaletteField,
  CustomizableField,
  ImagePickField,
  RangeField,
  SelectField,
  ToggleField,
} from "@react-ui-os/core";
import { getPath } from "@react-ui-os/core";
import { useBaseTheme, useSettings, useTheme } from "./desktop-context";
import { Slider, Toggle } from "./primitives";

/**
 * Settings system app body. Reads the active theme's `customizable` schema and
 * renders one editor per field. Layout follows modern settings apps (macOS
 * Ventura, Windows 11, GNOME): a category sidebar on the left and a content
 * pane of grouped rows on the right, each row a label and description on the
 * left with its control on the right. Edits write straight to the prefs store,
 * so the effective theme rebuilds live.
 */
export function Settings() {
  const theme = useTheme();
  const baseTheme = useBaseTheme();
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

  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        color: theme.palette.textPrimary,
        minHeight: 300,
      }}
    >
      <aside
        aria-label="Settings categories"
        style={{
          width: 150,
          flexShrink: 0,
          borderRight: `1px solid ${theme.palette.border}`,
          paddingRight: 12,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.2,
            padding: "2px 10px 8px",
          }}
        >
          Settings
        </div>
        {grouped.map(([name]) => {
          const isActive = name === activeName;
          return (
            <button
              key={name}
              type="button"
              aria-current={isActive}
              onClick={() => {
                setActive(name);
              }}
              style={{
                appearance: "none",
                border: 0,
                textAlign: "left",
                padding: "7px 10px",
                borderRadius: theme.shape.small,
                background: isActive ? `${theme.palette.accent}30` : "transparent",
                color: isActive
                  ? theme.palette.textPrimary
                  : theme.palette.textSecondary,
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
        <div style={{ flex: 1 }} />
        {hasPrefs && (
          <button
            type="button"
            onClick={resetAll}
            style={{
              border: 0,
              background: "transparent",
              textAlign: "left",
              color: theme.palette.textSecondary,
              fontSize: 12,
              padding: "7px 10px",
              cursor: "pointer",
              fontFamily: "inherit",
              borderRadius: theme.shape.small,
            }}
          >
            Reset all
          </button>
        )}
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>{activeName}</h2>
        <div
          style={{
            border: `1px solid ${theme.palette.border}`,
            borderRadius: theme.shape.small + 2,
            background: theme.palette.background,
            overflow: "hidden",
          }}
        >
          {activeFields.map(([path, field], i) => {
            const overridden = path in prefs;
            const value = path in prefs ? prefs[path] : getPath(baseTheme, path);
            return (
              <SettingRow
                key={path}
                field={field}
                value={value}
                overridden={overridden}
                isLast={i === activeFields.length - 1}
                onChange={(v) => {
                  setPref(path, v);
                }}
                onReset={() => {
                  resetPref(path);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface SettingRowProps {
  field: CustomizableField;
  value: unknown;
  overridden: boolean;
  isLast: boolean;
  onChange: (value: unknown) => void;
  onReset: () => void;
}

function SettingRow({
  field,
  value,
  overridden,
  isLast,
  onChange,
  onReset,
}: SettingRowProps) {
  const theme = useTheme();
  // Wide controls read better stacked under the label; the rest sit inline on
  // the right, the macOS / Windows / GNOME row pattern.
  const stacked = field.kind === "image-pick";
  const control = <FieldControl field={field} value={value} onChange={onChange} />;
  const controlNode =
    field.kind === "range" ? <div style={{ width: 180 }}>{control}</div> : control;
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
      {labelBlock}
      {stacked ? (
        controlNode
      ) : (
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
      )}
      {stacked && reset}
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
