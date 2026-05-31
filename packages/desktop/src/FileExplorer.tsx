"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useTheme } from "./desktop-context";
import { filterAndSortItems, type SortDir, type SortField } from "./util/explorer-sort";

/* ─── Types ──────────────────────────────────────────────────── */

export interface ExplorerItem {
  /** Stable id used as the React key and the action callback argument. */
  id: string;
  /** Visible label. */
  name: string;
  /** "Kind" cell in list view + group/sort field. */
  kind?: string;
  /** Epoch ms, drives the Date column + sort. */
  timestamp?: number;
  /** Optional one-line subtitle in icon view. */
  subtitle?: string;
  /** Optional right-aligned metadata in list view (e.g. file format). */
  meta?: string;
  /** Large tile icon, rendered in icon view. */
  icon?: ReactNode;
  /** Compact icon used in list view. Falls back to `icon`. */
  iconSmall?: ReactNode;
}

export interface ExplorerAction<T extends ExplorerItem = ExplorerItem> {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Receives all currently-selected items. Bulk-safe. */
  onClick: (items: T[]) => void;
  /** Show in red and below a divider in the context menu. */
  danger?: boolean;
  /** Hide when more than one item is selected. */
  singleOnly?: boolean;
  /** Optional keyboard hint shown in the context menu (e.g. "⌫", "F2"). */
  shortcut?: string;
}

export interface ExplorerSidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Tint applied to the icon and to the active background. */
  iconColor?: string;
  active?: boolean;
  onClick: () => void;
}

export interface ExplorerSidebarSection {
  label: string;
  items: ExplorerSidebarItem[];
}

export interface FileExplorerProps<T extends ExplorerItem = ExplorerItem> {
  items: T[];
  /** Triggered on double-click / Enter, single item. */
  onOpen?: (item: T) => void;
  /** When provided, items become renameable via F2 / context menu. */
  onRename?: (item: T, newName: string) => void;
  /** Buttons shown in the toolbar action bar + context menu. */
  actions?: ExplorerAction<T>[];
  /** Optional Finder-style left rail. */
  sidebar?: ExplorerSidebarSection[];
  /** Shown when items is empty. */
  emptyState?: ReactNode;
  /** Default view mode. Toggle is always available in the toolbar. */
  defaultView?: ViewMode;
}

type ViewMode = "icons" | "list";

interface ContextMenuTarget {
  x: number;
  y: number;
  /** When non-empty, the item-context menu is shown. Empty = empty-area menu. */
  itemIds: string[];
}

const SIDEBAR_WIDTH = 168;

/* ─── Component ──────────────────────────────────────────────── */

/**
 * Finder-style item explorer. Item-agnostic and host-driven: pass an
 * `items` array of your own shape mapped to `ExplorerItem`, optional
 * `actions`, an `onOpen` callback, and (for editable lists) an
 * `onRename` callback. The explorer owns selection, view mode, sort,
 * search, rename, and the context menu.
 *
 * Interaction model mirrors macOS Finder so the muscle memory carries
 * over:
 *
 *  - single click sets the selection
 *  - Cmd/Ctrl-click toggles an item in/out
 *  - Shift-click range-selects from the anchor
 *  - empty-area click clears
 *  - F2 begins rename; Enter / blur commits, Escape cancels
 *  - Delete / Backspace invokes the action with `id: "delete"` if present
 *  - Cmd/Ctrl+A selects all filtered items
 *  - Escape clears the selection, closes the context menu, cancels rename
 */
export function FileExplorer<T extends ExplorerItem>({
  items,
  onOpen,
  onRename,
  actions = [],
  sidebar,
  emptyState,
  defaultView = "icons",
}: FileExplorerProps<T>) {
  const theme = useTheme();

  const [view, setView] = useState<ViewMode>(defaultView);
  const [sort, setSort] = useState<SortField>("date");
  const [dir, setDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenuTarget | null>(null);

  const filtered = useMemo<T[]>(
    () => filterAndSortItems(items, { query, sort, dir }),
    [items, query, sort, dir],
  );

  const selectedItems = useMemo<T[]>(
    () => filtered.filter((it) => selectedIds.has(it.id)),
    [filtered, selectedIds],
  );

  /** Drop selected ids that disappeared (e.g. after delete). */
  useEffect(() => {
    const validIds = new Set(items.map((it) => it.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
    if (renamingId && !validIds.has(renamingId)) setRenamingId(null);
  }, [items, renamingId]);

  // These handlers and the visible-action list are passed to compiled child
  // rows; the React Compiler memoizes them, so no manual useCallback/useMemo.
  // (filtered, selectedItems, and beginRename stay memoized: they feed effect
  // dependency arrays below.)
  const handleSelect = (id: string, modifiers: { ctrl?: boolean; shift?: boolean }) => {
    if (modifiers.shift && anchorId) {
      const anchorIdx = filtered.findIndex((it) => it.id === anchorId);
      const clickIdx = filtered.findIndex((it) => it.id === id);
      if (anchorIdx >= 0 && clickIdx >= 0) {
        const [from, to] =
          anchorIdx <= clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx];
        const next = new Set<string>();
        for (let i = from; i <= to; i++) {
          const item = filtered[i];
          if (item) next.add(item.id);
        }
        setSelectedIds(next);
        return;
      }
    }
    if (modifiers.ctrl) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setAnchorId(id);
      return;
    }
    setSelectedIds(new Set([id]));
    setAnchorId(id);
  };

  const handleContextMenu = (e: ReactMouseEvent, itemId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    let ids: string[];
    if (itemId === null) {
      ids = [];
    } else if (selectedIds.has(itemId)) {
      ids = Array.from(selectedIds);
    } else {
      // Promote the right-clicked item to single selection.
      ids = [itemId];
      setSelectedIds(new Set([itemId]));
      setAnchorId(itemId);
    }
    setMenu({ x: e.clientX, y: e.clientY, itemIds: ids });
  };

  const commitRename = (id: string, newName: string) => {
    const item = items.find((it) => it.id === id);
    const trimmed = newName.trim();
    if (item && onRename && trimmed && trimmed !== item.name) {
      onRename(item, trimmed);
    }
    setRenamingId(null);
  };

  const beginRename = useCallback(() => {
    if (!onRename) return;
    if (selectedIds.size !== 1) return;
    const [id] = Array.from(selectedIds);
    if (id !== undefined) setRenamingId(id);
  }, [onRename, selectedIds]);

  const handleHeaderSort = (field: SortField) => {
    if (sort === field) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setDir(field === "name" ? "asc" : "desc");
    }
  };

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        setAnchorId(null);
        setMenu(null);
        setRenamingId(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(new Set(filtered.map((it) => it.id)));
        return;
      }
      if (selectedIds.size === 0) return;
      if (e.key === "Enter" && selectedIds.size === 1 && onOpen) {
        const [id] = Array.from(selectedIds);
        const it = items.find((x) => x.id === id);
        if (it) onOpen(it);
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        beginRename();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const deleteAction = actions.find((a) => a.id === "delete");
        if (deleteAction) {
          e.preventDefault();
          deleteAction.onClick(selectedItems);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [actions, beginRename, filtered, items, onOpen, selectedItems, selectedIds]);

  /** Toolbar actions visible right now: hide singleOnly when >1 selected. */
  const visibleActions = actions.filter(
    (a) => selectedItems.length > 0 && (!a.singleOnly || selectedItems.length === 1),
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        gap: 0,
        color: theme.palette.textPrimary,
        fontFamily: "inherit",
      }}
    >
      {sidebar && sidebar.length > 0 && (
        <Sidebar
          sections={sidebar}
          borderColor={theme.palette.border}
          textSecondary={theme.palette.textSecondary}
          radius={theme.shape.small}
        />
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          gap: 0,
        }}
      >
        <Toolbar
          view={view}
          onViewChange={setView}
          sortField={sort}
          sortDir={dir}
          onSortFieldChange={setSort}
          onSortDirToggle={() => {
            setDir(dir === "asc" ? "desc" : "asc");
          }}
          query={query}
          onQueryChange={setQuery}
          actions={visibleActions}
          selectedItems={selectedItems}
          themeBorder={theme.palette.border}
          themeText={theme.palette.textPrimary}
          themeTextMuted={theme.palette.textSecondary}
          themeRadius={theme.shape.small}
        />

        <div
          onClick={() => {
            setSelectedIds(new Set());
            setAnchorId(null);
          }}
          onContextMenu={(e) => {
            handleContextMenu(e, null);
          }}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            padding: 4,
          }}
        >
          {filtered.length === 0 ? (
            (emptyState ?? (
              <EmptyState message={query ? "No matches." : "Nothing here yet."} />
            ))
          ) : view === "icons" ? (
            <GridView
              items={filtered}
              selectedIds={selectedIds}
              renamingId={renamingId}
              onSelect={handleSelect}
              onOpen={onOpen}
              onContextMenu={handleContextMenu}
              onCommitRename={commitRename}
              onCancelRename={() => {
                setRenamingId(null);
              }}
            />
          ) : (
            <ListView
              items={filtered}
              selectedIds={selectedIds}
              renamingId={renamingId}
              sortField={sort}
              sortDir={dir}
              onSortFieldChange={handleHeaderSort}
              onSelect={handleSelect}
              onOpen={onOpen}
              onContextMenu={handleContextMenu}
              onCommitRename={commitRename}
              onCancelRename={() => {
                setRenamingId(null);
              }}
              themeBorder={theme.palette.border}
              themeTextMuted={theme.palette.textSecondary}
            />
          )}
        </div>

        <Footer
          count={filtered.length}
          total={items.length}
          selectedCount={selectedItems.length}
          themeBorder={theme.palette.border}
          themeTextMuted={theme.palette.textSecondary}
        />
      </div>

      {menu && (
        <ContextMenu
          target={menu}
          actions={actions}
          selectedItems={selectedItems}
          renamable={Boolean(onRename) && menu.itemIds.length === 1}
          openable={Boolean(onOpen) && menu.itemIds.length === 1}
          view={view}
          sort={sort}
          dir={dir}
          onClose={() => {
            setMenu(null);
          }}
          onOpenItem={() => {
            if (menu.itemIds.length === 1 && onOpen) {
              const id = menu.itemIds[0];
              if (id !== undefined) {
                const it = items.find((x) => x.id === id);
                if (it) onOpen(it);
              }
            }
            setMenu(null);
          }}
          onRename={() => {
            beginRename();
            setMenu(null);
          }}
          onSetView={(v) => {
            setView(v);
            setMenu(null);
          }}
          onSetSort={(field) => {
            handleHeaderSort(field);
            setMenu(null);
          }}
          themeSurface={theme.palette.surface}
          themeBorder={theme.palette.border}
          themeText={theme.palette.textPrimary}
          themeTextMuted={theme.palette.textSecondary}
          themeBlur={theme.blur.surface}
          themeRadius={theme.shape.small}
        />
      )}
    </div>
  );
}

/* ─── Toolbar ───────────────────────────────────────────────── */

function Toolbar<T extends ExplorerItem>({
  view,
  onViewChange,
  sortField,
  sortDir,
  onSortFieldChange,
  onSortDirToggle,
  query,
  onQueryChange,
  actions,
  selectedItems,
  themeBorder,
  themeText,
  themeTextMuted,
  themeRadius,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSortFieldChange: (f: SortField) => void;
  onSortDirToggle: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  actions: ExplorerAction<T>[];
  selectedItems: T[];
  themeBorder: string;
  themeText: string;
  themeTextMuted: string;
  themeRadius: number;
}) {
  const arrow = sortDir === "asc" ? "↑" : "↓";
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
          { value: "date", label: "Date" },
          { value: "name", label: "Name" },
          { value: "kind", label: "Kind" },
        ]}
        value={sortField}
        onChange={(v) => {
          onSortFieldChange(v as SortField);
        }}
      />
      <button
        type="button"
        onClick={onSortDirToggle}
        title={sortDir === "asc" ? "Ascending" : "Descending"}
        style={{
          border: `1px solid ${themeBorder}`,
          borderRadius: themeRadius,
          background: "transparent",
          color: themeText,
          padding: "3px 8px",
          fontSize: 12,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        {arrow}
      </button>
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
      {selectedItems.length > 0 && (
        <span style={{ fontSize: 11, color: themeTextMuted }}>
          {String(selectedItems.length)} selected
        </span>
      )}
      {primaryActions.map((action) => (
        <ToolbarButton
          key={action.id}
          label={action.label}
          icon={action.icon}
          themeBorder={themeBorder}
          themeText={themeText}
          themeRadius={themeRadius}
          onClick={() => {
            action.onClick(selectedItems);
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
          themeRadius={themeRadius}
          onClick={() => {
            action.onClick(selectedItems);
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
  const theme = useTheme();
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
              background: selected ? `${theme.palette.accent}38` : "transparent",
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
  themeBorder,
  themeText,
  themeRadius,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  themeBorder: string;
  themeText: string;
  themeRadius: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${themeBorder}`,
        borderRadius: themeRadius,
        padding: "3px 10px",
        background: "transparent",
        color: themeText,
        cursor: "pointer",
        fontSize: 11,
        fontFamily: "inherit",
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

/* ─── Grid view ──────────────────────────────────────────────── */

function GridView<T extends ExplorerItem>({
  items,
  selectedIds,
  renamingId,
  onSelect,
  onOpen,
  onContextMenu,
  onCommitRename,
  onCancelRename,
}: {
  items: T[];
  selectedIds: Set<string>;
  renamingId: string | null;
  onSelect: (id: string, mods: { ctrl?: boolean; shift?: boolean }) => void;
  onOpen?: (item: T) => void;
  onContextMenu: (e: ReactMouseEvent, itemId: string | null) => void;
  onCommitRename: (id: string, newName: string) => void;
  onCancelRename: () => void;
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
        const selected = selectedIds.has(item.id);
        const isRenaming = renamingId === item.id;
        return (
          <div
            key={item.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.id, {
                ctrl: e.metaKey || e.ctrlKey,
                shift: e.shiftKey,
              });
            }}
            onDoubleClick={() => onOpen?.(item)}
            onContextMenu={(e) => {
              onContextMenu(e, item.id);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: 8,
              borderRadius: theme.shape.small,
              background: selected ? `${theme.palette.accent}38` : "transparent",
              cursor: "pointer",
              color: theme.palette.textPrimary,
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
            {isRenaming ? (
              <RenameInput
                initial={item.name}
                onCommit={(name) => {
                  onCommitRename(item.id, name);
                }}
                onCancel={onCancelRename}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textAlign: "center",
                  width: "100%",
                }}
              />
            ) : (
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
            )}
            {item.kind && (
              <span style={{ fontSize: 10, color: theme.palette.textSecondary }}>
                {item.kind}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── List view ──────────────────────────────────────────────── */

function ListView<T extends ExplorerItem>({
  items,
  selectedIds,
  renamingId,
  sortField,
  sortDir,
  onSortFieldChange,
  onSelect,
  onOpen,
  onContextMenu,
  onCommitRename,
  onCancelRename,
  themeBorder,
  themeTextMuted,
}: {
  items: T[];
  selectedIds: Set<string>;
  renamingId: string | null;
  sortField: SortField;
  sortDir: SortDir;
  onSortFieldChange: (f: SortField) => void;
  onSelect: (id: string, mods: { ctrl?: boolean; shift?: boolean }) => void;
  onOpen?: (item: T) => void;
  onContextMenu: (e: ReactMouseEvent, itemId: string | null) => void;
  onCommitRename: (id: string, newName: string) => void;
  onCancelRename: () => void;
  themeBorder: string;
  themeTextMuted: string;
}) {
  const theme = useTheme();
  const arrow = sortDir === "asc" ? " ↑" : " ↓";

  const headerStyle: CSSProperties = {
    border: "none",
    background: "transparent",
    color: themeTextMuted,
    fontSize: 11,
    fontFamily: "inherit",
    fontWeight: 600,
    textAlign: "left",
    padding: "6px 8px",
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 100px 140px",
          alignItems: "center",
          borderBottom: `1px solid ${themeBorder}`,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            onSortFieldChange("name");
          }}
          style={headerStyle}
        >
          Name{sortField === "name" ? arrow : ""}
        </button>
        <button
          type="button"
          onClick={() => {
            onSortFieldChange("kind");
          }}
          style={headerStyle}
        >
          Kind{sortField === "kind" ? arrow : ""}
        </button>
        <button
          type="button"
          onClick={() => {
            onSortFieldChange("date");
          }}
          style={headerStyle}
        >
          Date{sortField === "date" ? arrow : ""}
        </button>
      </div>
      {items.map((item) => {
        const selected = selectedIds.has(item.id);
        const isRenaming = renamingId === item.id;
        return (
          <div
            key={item.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.id, {
                ctrl: e.metaKey || e.ctrlKey,
                shift: e.shiftKey,
              });
            }}
            onDoubleClick={() => onOpen?.(item)}
            onContextMenu={(e) => {
              onContextMenu(e, item.id);
            }}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 100px 140px",
              alignItems: "center",
              padding: "6px 8px",
              borderBottom: `1px solid ${themeBorder}`,
              background: selected ? `${theme.palette.accent}38` : "transparent",
              cursor: "pointer",
              color: theme.palette.textPrimary,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {item.iconSmall ?? item.icon ?? item.name.charAt(0).toUpperCase()}
              </span>
              {isRenaming ? (
                <RenameInput
                  initial={item.name}
                  onCommit={(name) => {
                    onCommitRename(item.id, name);
                  }}
                  onCancel={onCancelRename}
                  style={{ fontSize: 12, fontWeight: 500, flex: 1 }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </span>
              )}
            </span>
            <span style={{ fontSize: 11, color: themeTextMuted }}>
              {item.kind ?? ""}
            </span>
            <span style={{ fontSize: 11, color: themeTextMuted }}>
              {item.subtitle ?? (item.timestamp ? formatDate(item.timestamp) : "")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ─── Rename input ───────────────────────────────────────────── */

function RenameInput({
  initial,
  onCommit,
  onCancel,
  style,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
  style?: CSSProperties;
}) {
  const theme = useTheme();
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement | null>(null);
  // Suppress the blur-commit when Escape cancels the rename: blur fires
  // after the keydown handler tears down the input, and we don't want it
  // to write the stale value back to the host.
  const cancelledRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Select the stem (everything before the last "."), like macOS Finder.
    const lastDot = initial.lastIndexOf(".");
    const stemEnd = lastDot > 0 ? lastDot : initial.length;
    el.setSelectionRange(0, stemEnd);
  }, [initial]);

  const handleKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onCommit(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelledRef.current = true;
      onCancel();
    }
  };

  return (
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
      }}
      onKeyDown={handleKey}
      onBlur={() => {
        if (cancelledRef.current) return;
        onCommit(value);
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      style={{
        border: `1px solid ${theme.palette.accent}8c`,
        borderRadius: 4,
        background: "rgba(0,0,0,0.25)",
        color: "inherit",
        outline: "none",
        padding: "1px 4px",
        fontFamily: "inherit",
        ...style,
      }}
    />
  );
}

/* ─── Context menu ──────────────────────────────────────────── */

function ContextMenu<T extends ExplorerItem>({
  target,
  actions,
  selectedItems,
  renamable,
  openable,
  view,
  sort,
  dir,
  onClose,
  onOpenItem,
  onRename,
  onSetView,
  onSetSort,
  themeSurface,
  themeBorder,
  themeText,
  themeTextMuted,
  themeBlur,
  themeRadius,
}: {
  target: ContextMenuTarget;
  actions: ExplorerAction<T>[];
  selectedItems: T[];
  renamable: boolean;
  openable: boolean;
  view: ViewMode;
  sort: SortField;
  dir: SortDir;
  onClose: () => void;
  onOpenItem: () => void;
  onRename: () => void;
  onSetView: (v: ViewMode) => void;
  onSetSort: (f: SortField) => void;
  themeSurface: string;
  themeBorder: string;
  themeText: string;
  themeTextMuted: string;
  themeBlur: string;
  themeRadius: number;
}) {
  // Dismiss on outside click / scroll.
  useEffect(() => {
    const onAway = () => {
      onClose();
    };
    // Defer registration so the click that opened the menu doesn't close it.
    const t = window.setTimeout(() => {
      window.addEventListener("mousedown", onAway);
      window.addEventListener("scroll", onAway, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousedown", onAway);
      window.removeEventListener("scroll", onAway, true);
    };
  }, [onClose]);

  const isItemMenu = target.itemIds.length > 0;
  const itemCount = selectedItems.length;
  const visibleActions = actions.filter(
    (a) => itemCount > 0 && (!a.singleOnly || itemCount === 1),
  );
  const primary = visibleActions.filter((a) => !a.danger);
  const danger = visibleActions.filter((a) => a.danger);

  return (
    <div
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      style={{
        position: "fixed",
        top: target.y,
        left: target.x,
        minWidth: 180,
        maxWidth: 280,
        padding: 4,
        borderRadius: themeRadius + 2,
        border: `1px solid ${themeBorder}`,
        backgroundColor: themeSurface,
        backdropFilter: themeBlur,
        WebkitBackdropFilter: themeBlur,
        boxShadow: "0 14px 40px -12px rgba(0,0,0,0.6)",
        zIndex: 2000,
        color: themeText,
        fontSize: 12,
      }}
    >
      {isItemMenu ? (
        <>
          {openable && (
            <MenuRow
              label="Open"
              shortcut="↵"
              onClick={onOpenItem}
              themeTextMuted={themeTextMuted}
            />
          )}
          {renamable && (
            <MenuRow
              label="Rename"
              shortcut="F2"
              onClick={onRename}
              themeTextMuted={themeTextMuted}
            />
          )}
          {primary.map((a) => (
            <MenuRow
              key={a.id}
              label={a.label}
              icon={a.icon}
              shortcut={a.shortcut}
              onClick={() => {
                a.onClick(selectedItems);
                onClose();
              }}
              themeTextMuted={themeTextMuted}
            />
          ))}
          {danger.length > 0 && <MenuDivider color={themeBorder} />}
          {danger.map((a) => (
            <MenuRow
              key={a.id}
              label={a.label}
              icon={a.icon}
              shortcut={a.shortcut}
              danger
              onClick={() => {
                a.onClick(selectedItems);
                onClose();
              }}
              themeTextMuted={themeTextMuted}
            />
          ))}
        </>
      ) : (
        <>
          <MenuLabel text="View as" themeTextMuted={themeTextMuted} />
          <MenuRow
            label="Icons"
            checked={view === "icons"}
            onClick={() => {
              onSetView("icons");
            }}
            themeTextMuted={themeTextMuted}
          />
          <MenuRow
            label="List"
            checked={view === "list"}
            onClick={() => {
              onSetView("list");
            }}
            themeTextMuted={themeTextMuted}
          />
          <MenuDivider color={themeBorder} />
          <MenuLabel text="Sort by" themeTextMuted={themeTextMuted} />
          {(["date", "name", "kind"] as const).map((field) => (
            <MenuRow
              key={field}
              label={field === "date" ? "Date" : field === "name" ? "Name" : "Kind"}
              shortcut={sort === field ? (dir === "asc" ? "↑" : "↓") : undefined}
              checked={sort === field}
              onClick={() => {
                onSetSort(field);
              }}
              themeTextMuted={themeTextMuted}
            />
          ))}
        </>
      )}
    </div>
  );
}

function MenuRow({
  label,
  icon,
  shortcut,
  checked,
  danger,
  onClick,
  themeTextMuted,
}: {
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  checked?: boolean;
  danger?: boolean;
  onClick: () => void;
  themeTextMuted: string;
}) {
  const theme = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: danger ? "#ff6868" : "inherit",
        padding: "5px 8px",
        borderRadius: 4,
        fontFamily: "inherit",
        fontSize: 12,
        textAlign: "left",
      }}
      onPointerEnter={(e) => {
        e.currentTarget.style.background = `${theme.palette.accent}2e`;
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          width: 14,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? "✓" : (icon ?? null)}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span
          style={{
            fontSize: 11,
            color: themeTextMuted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}

function MenuLabel({ text, themeTextMuted }: { text: string; themeTextMuted: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        color: themeTextMuted,
        padding: "6px 8px 2px",
      }}
    >
      {text}
    </div>
  );
}

function MenuDivider({ color }: { color: string }) {
  return (
    <div style={{ height: 1, background: color, margin: "4px 4px" }} aria-hidden />
  );
}

/* ─── Sidebar ────────────────────────────────────────────────── */

function Sidebar({
  sections,
  borderColor,
  textSecondary,
  radius,
}: {
  sections: ExplorerSidebarSection[];
  borderColor: string;
  textSecondary: string;
  radius: number;
}) {
  const theme = useTheme();
  return (
    <div
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        borderRight: `1px solid ${borderColor}`,
        padding: "8px 6px",
        overflow: "auto",
        background: "rgba(0,0,0,0.18)",
      }}
    >
      {sections.map((section) => (
        <div key={section.label} style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              color: textSecondary,
              padding: "4px 6px",
            }}
          >
            {section.label}
          </div>
          {section.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                border: "none",
                background: item.active ? `${theme.palette.accent}38` : "transparent",
                color: "inherit",
                cursor: "pointer",
                padding: "5px 8px",
                borderRadius: radius,
                fontFamily: "inherit",
                fontSize: 12,
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: item.iconColor,
                }}
              >
                {item.icon ?? "•"}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Footer ─────────────────────────────────────────────────── */

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
  selectedCount,
  themeBorder,
  themeTextMuted,
}: {
  count: number;
  total: number;
  selectedCount: number;
  themeBorder: string;
  themeTextMuted: string;
}) {
  const base =
    count === total
      ? `${String(total)} item${total === 1 ? "" : "s"}`
      : `${String(count)} of ${String(total)} item${total === 1 ? "" : "s"}`;
  const sel = selectedCount > 0 ? ` · ${String(selectedCount)} selected` : "";
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
      {base}
      {sel}
    </div>
  );
}
