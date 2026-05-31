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
import { useApp, useDesktopContext, useTheme, Toggle } from "@react-ui-os/desktop";
import {
  addReminder,
  clearCompleted,
  deleteReminder,
  listReminders,
  REMINDERS_STORAGE_KEY,
  renameReminder,
  toggleComplete,
  toggleFlag,
  type Reminder,
} from "./reminders-store";

function CompletionCircle({ checked }: { checked: boolean }) {
  // macOS Reminders "Mark Complete" control: an open circle to the left of
  // the title that fills with the list accent and shows a tick once done.
  // https://support.apple.com/guide/reminders/mark-reminders-complete-or-incomplete-remndbeda47c/mac
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx={10} cy={10} r={8} fill={checked ? "currentColor" : "none"} />
      {checked && <path d="m6.5 10 2.2 2.2 4.8-4.8" stroke="#fff" strokeWidth={1.8} />}
    </svg>
  );
}

function FlagIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
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

interface RowProps {
  reminder: Reminder;
  accent: string;
  onToggleComplete: (id: string) => void;
  onToggleFlag: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function ReminderRow({
  reminder,
  accent,
  onToggleComplete,
  onToggleFlag,
  onRename,
  onDelete,
}: RowProps) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reminder.title);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const beginEdit = useCallback(() => {
    setDraft(reminder.title);
    setEditing(true);
  }, [reminder.title]);

  const commit = useCallback(() => {
    if (!editing) return;
    setEditing(false);
    if (draft.trim() && draft.trim() !== reminder.title) {
      onRename(reminder.id, draft);
    }
  }, [draft, editing, onRename, reminder.id, reminder.title]);

  const cancel = useCallback(() => {
    setDraft(reminder.title);
    setEditing(false);
  }, [reminder.title]);

  const onEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const hoverActions = hovered || focusWithin;
  const showFlag = hoverActions || reminder.flagged;

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderBottom: `1px solid ${theme.palette.border}`,
  };

  const titleStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 1.3,
    color: reminder.completed ? theme.palette.textSecondary : theme.palette.textPrimary,
    textDecoration: reminder.completed ? "line-through" : "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    cursor: "text",
  };

  const iconButton = (active: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 26,
    padding: 0,
    border: "none",
    borderRadius: theme.shape.small,
    background: "transparent",
    color: active ? accent : theme.palette.textSecondary,
    cursor: "pointer",
    flexShrink: 0,
  });

  return (
    <li
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        const next = e.relatedTarget as HTMLElement | null;
        if (!next || !e.currentTarget.contains(next)) {
          setFocusWithin(false);
        }
      }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={reminder.completed}
        aria-label={
          reminder.completed
            ? `Mark "${reminder.title}" as not done`
            : `Mark "${reminder.title}" as done`
        }
        onClick={() => onToggleComplete(reminder.id)}
        style={iconButton(reminder.completed)}
      >
        <CompletionCircle checked={reminder.completed} />
      </button>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onEditKeyDown}
          onBlur={commit}
          aria-label={`Edit reminder "${reminder.title}"`}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontFamily: "inherit",
            color: theme.palette.textPrimary,
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${accent}`,
            outline: "none",
            padding: "2px 0",
          }}
        />
      ) : (
        <span style={titleStyle} onDoubleClick={beginEdit} title={reminder.title}>
          {reminder.title}
        </span>
      )}

      <button
        type="button"
        aria-pressed={reminder.flagged}
        aria-label={
          reminder.flagged
            ? `Remove flag from "${reminder.title}"`
            : `Flag "${reminder.title}"`
        }
        onClick={() => onToggleFlag(reminder.id)}
        style={{
          ...iconButton(reminder.flagged),
          visibility: showFlag ? "visible" : "hidden",
        }}
      >
        <FlagIcon filled={reminder.flagged} />
      </button>

      <button
        type="button"
        aria-label={`Edit reminder "${reminder.title}"`}
        onClick={beginEdit}
        style={{
          ...iconButton(false),
          width: "auto",
          padding: "0 6px",
          fontSize: 12,
          fontFamily: "inherit",
          visibility: hoverActions ? "visible" : "hidden",
        }}
      >
        Edit
      </button>

      <button
        type="button"
        aria-label={`Delete reminder "${reminder.title}"`}
        onClick={() => onDelete(reminder.id)}
        style={{
          ...iconButton(false),
          visibility: hoverActions ? "visible" : "hidden",
        }}
      >
        <TrashIcon />
      </button>
    </li>
  );
}

export function RemindersContent({ appId }: { appId: string }) {
  const { storage } = useDesktopContext();
  const theme = useTheme();
  const app = useApp(appId);
  const accent = app?.accent ?? theme.palette.accent;

  const [reminders, setReminders] = useState<Reminder[]>(() => listReminders(storage));
  const [showCompleted, setShowCompleted] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const addInputId = useId();

  useEffect(() => {
    const refresh = () => {
      setReminders(listReminders(storage));
    };
    refresh();
    const unsubscribe = storage.subscribe((key) => {
      if (key === REMINDERS_STORAGE_KEY) refresh();
    });
    return unsubscribe;
  }, [storage]);

  const handleAdd = useCallback(() => {
    if (!newTitle.trim()) return;
    addReminder(storage, newTitle);
    setNewTitle("");
  }, [newTitle, storage]);

  const completedCount = reminders.filter((r) => r.completed).length;
  const remainingCount = reminders.length - completedCount;
  const visible = useMemo(
    () => (showCompleted ? reminders : reminders.filter((r) => !r.completed)),
    [reminders, showCompleted],
  );

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
    padding: "10px 12px",
    borderBottom: `1px solid ${theme.palette.border}`,
  };

  const addRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderBottom: `1px solid ${theme.palette.border}`,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Reminders</span>
          <span style={{ fontSize: 12, color: theme.palette.textSecondary }}>
            {remainingCount} left
          </span>
        </div>
        <Toggle
          checked={showCompleted}
          onChange={setShowCompleted}
          accent={accent}
          ariaLabel="Show completed reminders"
          label="Completed"
        />
      </div>

      <form
        style={addRowStyle}
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
      >
        <button
          type="submit"
          aria-label="Add reminder"
          disabled={!newTitle.trim()}
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
            color: newTitle.trim() ? accent : theme.palette.textSecondary,
            cursor: newTitle.trim() ? "pointer" : "default",
            flexShrink: 0,
          }}
        >
          <PlusIcon />
        </button>
        <label htmlFor={addInputId} style={{ position: "absolute", left: -9999 }}>
          New reminder
        </label>
        <input
          id={addInputId}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a reminder"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontFamily: "inherit",
            color: theme.palette.textPrimary,
            background: "transparent",
            border: "none",
            outline: "none",
            padding: "4px 0",
          }}
        />
      </form>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          flex: 1,
          overflowY: "auto",
        }}
      >
        {visible.length === 0 ? (
          <li
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "48px 20px",
              textAlign: "center",
              color: theme.palette.textSecondary,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500 }}>No reminders</span>
            <span style={{ fontSize: 12 }}>
              {reminders.length === 0
                ? "Type above and press Return to add your first one."
                : "Nothing left to do."}
            </span>
          </li>
        ) : (
          visible.map((reminder) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              accent={accent}
              onToggleComplete={(id) => toggleComplete(storage, id)}
              onToggleFlag={(id) => toggleFlag(storage, id)}
              onRename={(id, title) => renameReminder(storage, id, title)}
              onDelete={(id) => deleteReminder(storage, id)}
            />
          ))
        )}
      </ul>

      {completedCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "8px 12px",
            borderTop: `1px solid ${theme.palette.border}`,
            fontSize: 12,
            color: theme.palette.textSecondary,
          }}
        >
          <span>{completedCount} completed</span>
          <button
            type="button"
            onClick={() => clearCompleted(storage)}
            style={{
              border: "none",
              background: "transparent",
              color: accent,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
              padding: "2px 4px",
            }}
          >
            Clear Completed
          </button>
        </div>
      )}
    </div>
  );
}
