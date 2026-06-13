import type { CSSProperties, ReactNode } from "react";

/**
 * Control primitives for the theme editor panel. The panel deliberately does
 * NOT restyle itself with the theme being edited: a half-finished palette
 * must never make the editor itself unreadable, so everything here uses a
 * fixed neutral dark surface.
 */

export const panelText = "#e8eaf2";
export const panelMuted = "rgba(232, 234, 242, 0.6)";
export const panelHairline = "rgba(255, 255, 255, 0.1)";
const controlBg = "rgba(255, 255, 255, 0.07)";

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: panelMuted,
  marginBottom: 4,
};

const rowStyle: CSSProperties = { marginBottom: 12 };

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: controlBg,
  border: `1px solid ${panelHairline}`,
  borderRadius: 6,
  color: panelText,
  fontSize: 12,
  fontFamily: "inherit",
  padding: "6px 8px",
};

export function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      style={{ borderTop: `1px solid ${panelHairline}`, padding: "2px 0" }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          color: panelText,
          padding: "8px 2px",
          userSelect: "none",
          listStyle: "revert",
        }}
      >
        {title}
      </summary>
      <div style={{ padding: "4px 2px 10px" }}>{children}</div>
    </details>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

/** rgba(...)/named colors keep the text field as source of truth; the native
 * picker writes an opaque hex. Good enough for picking, with rgba editable
 * by hand for the translucent surfaces. */
function toHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return "#888888";
  const hex = (n: string) =>
    Math.max(0, Math.min(255, Number(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${hex(m[1] ?? "0")}${hex(m[2] ?? "0")}${hex(m[3] ?? "0")}`;
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span
          style={{
            position: "relative",
            width: 26,
            height: 26,
            flex: "none",
            borderRadius: 6,
            border: `1px solid ${panelHairline}`,
            background: value,
            overflow: "hidden",
          }}
        >
          <input
            type="color"
            aria-label={`${label} color picker`}
            value={toHex(value)}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              inset: -6,
              width: "calc(100% + 12px)",
              height: "calc(100% + 12px)",
              opacity: 0,
              cursor: "pointer",
            }}
          />
        </span>
        <input
          type="text"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>
    </div>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <label style={rowStyle}>
      <span style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: panelText }}>
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#9aa3b8" }}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const known = options.some((o) => o.value === value);
  return (
    <label style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, cursor: "pointer" }}
      >
        {!known && <option value={value}>Custom: {value}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      style={{
        ...rowStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 12, color: panelMuted }}>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "#9aa3b8", width: 14, height: 14 }}
      />
    </label>
  );
}
