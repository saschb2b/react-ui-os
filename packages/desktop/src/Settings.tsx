"use client";

import { useMemo } from "react";
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
 * Settings system app body. Reads the active theme's `customizable` schema
 * and renders one editor per field, grouped by `section`. Edits write
 * directly to the prefs store; the effective theme rebuilds on every change
 * so the desktop reflects tweaks live.
 */
export function Settings() {
  const theme = useTheme();
  const baseTheme = useBaseTheme();
  const { schema, prefs, setPref, resetPref, resetAll } = useSettings();

  const grouped = useMemo(() => {
    const sections = new Map<string, Array<[string, CustomizableField]>>();
    for (const [path, field] of Object.entries(schema)) {
      const section = field.section ?? "General";
      const arr = sections.get(section) ?? [];
      arr.push([path, field]);
      sections.set(section, arr);
    }
    return Array.from(sections.entries());
  }, [schema]);

  const hasPrefs = Object.keys(prefs).length > 0;
  const isEmpty = Object.keys(schema).length === 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        color: theme.palette.textPrimary,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Settings</h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: theme.palette.textSecondary,
            }}
          >
            Tweaks to the {baseTheme.name} theme.
          </p>
        </div>
        {hasPrefs && (
          <button
            type="button"
            onClick={resetAll}
            style={{
              border: `1px solid ${theme.palette.border}`,
              borderRadius: theme.shape.small,
              background: "transparent",
              color: theme.palette.textSecondary,
              fontSize: 12,
              padding: "4px 10px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reset all
          </button>
        )}
      </header>

      {isEmpty ? (
        <p
          style={{
            fontSize: 13,
            color: theme.palette.textSecondary,
            margin: 0,
          }}
        >
          The active theme exposes no customizable settings.
        </p>
      ) : (
        grouped.map(([sectionName, fields]) => (
          <section
            key={sectionName}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: theme.palette.textSecondary,
                fontWeight: 600,
              }}
            >
              {sectionName}
            </h3>
            {fields.map(([path, field]) => {
              const overridden = path in prefs;
              const value =
                path in prefs ? prefs[path] : getPath(baseTheme, path);
              return (
                <FieldRow
                  key={path}
                  field={field}
                  value={value}
                  overridden={overridden}
                  onChange={(v) => {
                    setPref(path, v);
                  }}
                  onReset={() => {
                    resetPref(path);
                  }}
                />
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}

interface FieldRowProps {
  field: CustomizableField;
  value: unknown;
  overridden: boolean;
  onChange: (value: unknown) => void;
  onReset: () => void;
}

function FieldRow({
  field,
  value,
  overridden,
  onChange,
  onReset,
}: FieldRowProps) {
  const theme = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 500 }}>{field.label}</label>
        {overridden && (
          <button
            type="button"
            onClick={onReset}
            style={{
              border: "none",
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
        )}
      </div>
      {field.description && (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: theme.palette.textSecondary,
          }}
        >
          {field.description}
        </p>
      )}
      <FieldControl field={field} value={value} onChange={onChange} />
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
      return (
        <ToggleControl
          field={field}
          value={Boolean(value)}
          onChange={onChange}
        />
      );
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
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            onClick={() => {
              onChange(opt.value);
            }}
            style={{
              border: "none",
              background: selected
                ? "rgba(120,160,220,0.22)"
                : "transparent",
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
