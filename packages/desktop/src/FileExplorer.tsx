"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTheme } from "./desktop-context";

export interface ExplorerItem {
  /** Stable id used as the React key and the action callback argument. */
  id: string;
  /** Visible label. */
  name: string;
  /** Optional file-extension-style label shown below the name in grid view. */
  kind?: string;
  /** Optional epoch ms used by the Date sort. */
  timestamp?: number;
  /** Optional secondary line in list view. */
  subtitle?: string;
  /** Optional thumbnail used in grid view. */
  icon?: ReactNode;
  /** Optional row icon for list view (defaults to `icon`). */
  iconSmall?: ReactNode;
}

export interface ExplorerAction {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Renders below a divider and in red text. */
  danger?: boolean;
  onClick: (items: ExplorerItem[]) => void;
}

export interface FileExplorerProps {
  items: ExplorerItem[];
  onOpen?: (item: ExplorerItem) => void;
  actions?: ExplorerAction[];
  /** Default view mode. Toggle is always available in the toolbar. */
  initialView?: "icons" | "list";
  /** Empty-state message when no items are present. */
  emptyMessage?: string;
}

type ViewMode = "icons" | "list";
type SortKey = "date" | "name" | "kind";

/**
 * Finder-style item explorer. Item-agnostic: hosts pass an `items` array
 * with their own shape mapped to `ExplorerItem`, optional `actions`, and an
 * `onOpen` callback. The explorer owns view mode, sort, search, and the
 * single-selection model.
 *
 * Phase 4 scope keeps this minimal: grid + list, search, sort, click-to-open,
 * action buttons. Future work layers in rename (F2), multi-select
 * (Shift / Cmd-click), and a sidebar of sibling folders.
 */
export function FileExplorer({
  items,
  onOpen,
  actions = [],
  initialView = "icons",
  emptyMessage = "Nothing here yet.",
}: FileExplorerProps) {
  const theme = useTheme();
  const [view, setView] = useState<ViewMode>(initialView);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((it) => {
          const name = it.name.toLowerCase();
          const kind = (it.kind ?? "").toLowerCase();
          const subtitle = (it.subtitle ?? "").toLowerCase();
          return name.includes(q) || kind.includes(q) || subtitle.includes(q);
        })
      : items.slice();
    base.sort((a, b) => {
      if (sortKey === "name") {
        return a.name.localeCompare(b.name) * (sortAsc ? 1 : -1);
      }
      if (sortKey === "kind") {
        return (
          (a.kind ?? "").localeCompare(b.kind ?? "") * (sortAsc ? 1 : -1)
        );
      }
      const at = a.timestamp ?? 0;
      const bt = b.timestamp ?? 0;
      return (at - bt) * (sortAsc ? 1 : -1);
    });
    return base;
  }, [items, query, sortKey, sortAsc]);

  // Drop the selection when the item it pointed at disappears.
  if (selectedId && !filtered.some((i) => i.id === selectedId)) {
    setSelectedId(null);
  }

  const selectedItem = selectedId
    ? (items.find((i) => i.id === selectedId) ?? null)
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        gap: 8,
      }}
    >
      <Toolbar
        view={view}
        onViewChange={setView}
        sortKey={sortKey}
        sortAsc={sortAsc}
        onSortChange={(key) => {
          if (key === sortKey) setSortAsc((v) => !v);
          else {
            setSortKey(key);
            setSortAsc(false);
          }
        }}
        query={query}
        onQueryChange={setQuery}
        actions={actions}
        selectedItem={selectedItem}
        themeBorder={theme.palette.border}
        themeText={theme.palette.textPrimary}
        themeTextMuted={theme.palette.textSecondary}
        themeRadius={theme.shape.small}
      />

      <div
        onClick={() => {
          setSelectedId(null);
        }}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: 4,
        }}
      >
        {filtered.length === 0 ? (
          <EmptyState message={query ? "No matches." : emptyMessage} />
        ) : view === "icons" ? (
          <GridView
            items={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpen={onOpen}
          />
        ) : (
          <ListView
            items={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpen={onOpen}
            themeBorder={theme.palette.border}
            themeTextMuted={theme.palette.textSecondary}
          />
        )}
      </div>

      <Footer
        count={filtered.length}
        total={items.length}
        themeBorder={theme.palette.border}
        themeTextMuted={theme.palette.textSecondary}
      />
    </div>
  );
}

function Toolbar({
  view,
  onViewChange,
  sortKey,
  sortAsc,
  onSortChange,
  query,
  onQueryChange,
  actions,
  selectedItem,
  themeBorder,
  themeText,
  themeTextMuted,
  themeRadius,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  sortKey: SortKey;
  sortAsc: boolean;
  onSortChange: (k: SortKey) => void;
  query: string;
  onQueryChange: (q: string) => void;
  actions: ExplorerAction[];
  selectedItem: ExplorerItem | null;
  themeBorder: string;
  themeText: string;
  themeTextMuted: string;
  themeRadius: number;
}) {
  const dirGlyph = sortAsc ? "↑" : "↓";

  const dangerActions = actions.filter((a) => a.danger);
  const primaryActions = actions.filter((a) => !a.danger);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: 6,
        borderBottom: `1px solid ${themeBorder}`,
        flexShrink: 0,
        flexWrap: "wrap",
      }}
    >
      <Segmented
        themeBorder={themeBorder}
        themeText={themeText}
        themeRadius={themeRadius}
        options={[
          { value: "icons", label: "Icons" },
          { value: "list", label: "List" },
        ]}
        value={view}
        onChange={(v) => {
          onViewChange(v as ViewMode);
        }}
      />
      <Segmented
        themeBorder={themeBorder}
        themeText={themeText}
        themeRadius={themeRadius}
        options={[
          { value: "date", label: `Date ${sortKey === "date" ? dirGlyph : ""}` },
          { value: "name", label: `Name ${sortKey === "name" ? dirGlyph : ""}` },
          { value: "kind", label: `Kind ${sortKey === "kind" ? dirGlyph : ""}` },
        ]}
        value={sortKey}
        onChange={(v) => {
          onSortChange(v as SortKey);
        }}
      />
      <input
        type="search"
        placeholder="Search"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
        }}
        style={{
          flex: "1 1 140px",
          minWidth: 100,
          height: 26,
          border: `1px solid ${themeBorder}`,
          borderRadius: themeRadius,
          background: "transparent",
          color: themeText,
          padding: "0 8px",
          fontFamily: "inherit",
          fontSize: 12,
          outline: "none",
        }}
      />
      {primaryActions.map((action) => (
        <ToolbarButton
          key={action.id}
          label={action.label}
          icon={action.icon}
          themeBorder={themeBorder}
          themeText={themeText}
          themeTextMuted={themeTextMuted}
          themeRadius={themeRadius}
          disabled={!selectedItem}
          onClick={() => {
            if (selectedItem) action.onClick([selectedItem]);
          }}
        />
      ))}
      {dangerActions.map((action) => (
        <ToolbarButton
          key={action.id}
          label={action.label}
          icon={action.icon}
          themeBorder={themeBorder}
          themeText={"#ff6868"}
          themeTextMuted={themeTextMuted}
          themeRadius={themeRadius}
          disabled={!selectedItem}
          onClick={() => {
            if (selectedItem) action.onClick([selectedItem]);
          }}
        />
      ))}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
  themeBorder,
  themeText,
  themeRadius,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  themeBorder: string;
  themeText: string;
  themeRadius: number;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: `1px solid ${themeBorder}`,
        borderRadius: themeRadius,
        overflow: "hidden",
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChange(opt.value);
            }}
            style={{
              border: "none",
              padding: "4px 10px",
              fontSize: 11,
              fontFamily: "inherit",
              cursor: "pointer",
              background: selected
                ? "rgba(120,160,220,0.22)"
                : "transparent",
              color: themeText,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ToolbarButton({
  label,
  icon,
  onClick,
  disabled,
  themeBorder,
  themeText,
  themeTextMuted,
  themeRadius,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  themeBorder: string;
  themeText: string;
  themeTextMuted: string;
  themeRadius: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${themeBorder}`,
        borderRadius: themeRadius,
        padding: "3px 10px",
        background: "transparent",
        color: disabled ? themeTextMuted : themeText,
        cursor: disabled ? "default" : "pointer",
        fontSize: 11,
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function GridView({
  items,
  selectedId,
  onSelect,
  onOpen,
}: {
  items: ExplorerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen?: (item: ExplorerItem) => void;
}) {
  const theme = useTheme();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
        gap: 4,
        padding: 4,
      }}
    >
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.id);
            }}
            onDoubleClick={() => onOpen?.(item)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: 8,
              border: "none",
              borderRadius: theme.shape.small,
              background: selected ? "rgba(120,160,220,0.22)" : "transparent",
              cursor: "pointer",
              color: theme.palette.textPrimary,
              fontFamily: "inherit",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: theme.shape.small + 2,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                border: `1px solid ${theme.palette.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              {item.icon ?? item.name.charAt(0).toUpperCase()}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {item.name}
            </span>
            {item.kind && (
              <span
                style={{
                  fontSize: 10,
                  color: theme.palette.textSecondary,
                }}
              >
                {item.kind}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ListView({
  items,
  selectedId,
  onSelect,
  onOpen,
  themeBorder,
  themeTextMuted,
}: {
  items: ExplorerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen?: (item: ExplorerItem) => void;
  themeBorder: string;
  themeTextMuted: string;
}) {
  const theme = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.id);
            }}
            onDoubleClick={() => onOpen?.(item)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 8px",
              border: "none",
              borderBottom: `1px solid ${themeBorder}`,
              background: selected ? "rgba(120,160,220,0.22)" : "transparent",
              cursor: "pointer",
              color: theme.palette.textPrimary,
              fontFamily: "inherit",
              textAlign: "left",
              width: "100%",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
              }}
            >
              {item.iconSmall ?? item.icon ?? item.name.charAt(0).toUpperCase()}
            </span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>
              {item.name}
            </span>
            {item.subtitle && (
              <span style={{ fontSize: 11, color: themeTextMuted }}>
                {item.subtitle}
              </span>
            )}
            {item.kind && (
              <span style={{ fontSize: 11, color: themeTextMuted }}>
                {item.kind}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <div
      style={{
        padding: "40px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: theme.palette.textSecondary,
        fontSize: 12,
      }}
    >
      {message}
    </div>
  );
}

function Footer({
  count,
  total,
  themeBorder,
  themeTextMuted,
}: {
  count: number;
  total: number;
  themeBorder: string;
  themeTextMuted: string;
}) {
  const label =
    count === total
      ? `${String(total)} item${total === 1 ? "" : "s"}`
      : `${String(count)} of ${String(total)} item${total === 1 ? "" : "s"}`;
  return (
    <div
      style={{
        height: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderTop: `1px solid ${themeBorder}`,
        color: themeTextMuted,
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  );
}
