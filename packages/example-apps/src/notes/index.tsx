"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentRef, CSSProperties, KeyboardEvent } from "react";
import type { App } from "@react-ui-os/core";
import { useApp, useDesktopContext, useTheme } from "@react-ui-os/desktop";
import { NotesIcon } from "./icon";
import {
  createNote,
  deleteNote,
  listNotes,
  noteSnippet,
  noteTitle,
  NOTES_STORAGE_KEY,
  updateNote,
  type Note,
} from "./notes-store";

const SIDEBAR_WIDTH = 240;

/**
 * Relative timestamp shown in the list, in the spirit of the Apple Notes
 * "Date Edited" column: time of day for today, "Yesterday", a weekday name
 * within the last week, then a calendar date.
 */
function relativeTime(ms: number): string {
  const now = new Date();
  const then = new Date(ms);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (dayDiff <= 0) {
    return then.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return then.toLocaleDateString(undefined, { weekday: "long" });
  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: then.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function NotesContent() {
  const { storage } = useDesktopContext();
  const theme = useTheme();
  // The app's own accent, read from the registry rather than hardcoded, so a
  // theme override of the accent flows through here too.
  const accent = useApp("notes")?.accent ?? theme.palette.accent;

  const [notes, setNotes] = useState<Note[]>(() => listNotes(storage));
  const [selectedId, setSelectedId] = useState<string | null>(
    () => listNotes(storage)[0]?.id ?? null,
  );
  const [listFocused, setListFocused] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const textareaRef = useRef<ComponentRef<"textarea">>(null);

  useEffect(() => {
    const refresh = () => {
      setNotes(listNotes(storage));
    };
    refresh();
    const unsubscribe = storage.subscribe((key) => {
      if (key === NOTES_STORAGE_KEY) refresh();
    });
    return unsubscribe;
  }, [storage]);

  // Keep the selection valid when notes change externally (another window,
  // a delete in this one). Fall back to the first note, or nothing.
  useEffect(() => {
    if (notes.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!notes.some((n) => n.id === selectedId)) {
      setSelectedId(notes[0]?.id ?? null);
    }
  }, [notes, selectedId]);

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  const handleNew = useCallback(() => {
    const note = createNote(storage);
    setSelectedId(note.id);
    // Focus the editor so the user can type the first line (the title) at once.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [storage]);

  const handleDelete = useCallback(
    (id: string) => {
      const index = notes.findIndex((n) => n.id === id);
      // Selection moves to the next note, or the previous one if last.
      const fallback = notes[index + 1] ?? notes[index - 1] ?? null;
      deleteNote(storage, id);
      setSelectedId(fallback?.id ?? null);
    },
    [notes, storage],
  );

  const handleEdit = useCallback(
    (body: string) => {
      if (!selectedId) return;
      // Reflect the edit locally first so the textarea and list stay live even
      // before the storage change event round-trips back.
      setNotes((prev) =>
        prev
          .map((n) => (n.id === selectedId ? { ...n, body, updatedAt: Date.now() } : n))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      );
      updateNote(storage, selectedId, body);
    },
    [selectedId, storage],
  );

  const handleListKeyDown = useCallback(
    (event: KeyboardEvent<ComponentRef<"ul">>) => {
      if (notes.length === 0) return;
      const index = notes.findIndex((n) => n.id === selectedId);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = notes[Math.min(index + 1, notes.length - 1)];
        if (next) setSelectedId(next.id);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = notes[Math.max(index - 1, 0)];
        if (prev) setSelectedId(prev.id);
      } else if ((event.key === "Backspace" || event.key === "Delete") && selectedId) {
        event.preventDefault();
        handleDelete(selectedId);
      }
    },
    [notes, selectedId, handleDelete],
  );

  const rootStyle: CSSProperties = {
    display: "flex",
    height: "100%",
    minHeight: 0,
    margin: -16, // App content has default padding; the panes go edge to edge.
    color: theme.palette.textPrimary,
    fontSize: 13,
  };

  const sidebarStyle: CSSProperties = {
    width: SIDEBAR_WIDTH,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    borderRight: `1px solid ${theme.palette.border}`,
  };

  const toolbarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "8px 10px",
    borderBottom: `1px solid ${theme.palette.border}`,
  };

  const iconButtonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    padding: 0,
    color: theme.palette.textSecondary,
    background: "transparent",
    border: `1px solid ${theme.palette.border}`,
    borderRadius: theme.shape.small,
    cursor: "pointer",
  };

  const listStyle: CSSProperties = {
    listStyle: "none",
    margin: 0,
    padding: 0,
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
    outline: listFocused ? `2px solid ${accent}` : "none",
    outlineOffset: -2,
  };

  const editorStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  };

  const textareaStyle: CSSProperties = {
    flex: 1,
    width: "100%",
    boxSizing: "border-box",
    resize: "none",
    border: "none",
    outline: editorFocused ? `2px solid ${accent}` : "none",
    outlineOffset: -2,
    background: "transparent",
    color: theme.palette.textPrimary,
    padding: "16px 18px",
    fontFamily: "inherit",
    fontSize: 14,
    lineHeight: 1.5,
  };

  const emptyStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    color: theme.palette.textSecondary,
    padding: 24,
    textAlign: "center",
  };

  return (
    <div style={rootStyle}>
      <div style={sidebarStyle}>
        <div style={toolbarStyle}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.3,
              color: theme.palette.textSecondary,
            }}
          >
            {notes.length} {notes.length === 1 ? "Note" : "Notes"}
          </span>
          <button
            type="button"
            aria-label="New note"
            title="New note"
            onClick={handleNew}
            style={iconButtonStyle}
          >
            <NewNoteGlyph />
          </button>
        </div>

        {notes.length === 0 ? (
          <div style={emptyStyle}>
            <NotesIcon size={28} />
            <span style={{ fontSize: 12 }}>No notes yet.</span>
            <button
              type="button"
              onClick={handleNew}
              style={{
                ...iconButtonStyle,
                width: "auto",
                gap: 6,
                padding: "6px 12px",
                color: theme.palette.textPrimary,
              }}
            >
              <NewNoteGlyph />
              New Note
            </button>
          </div>
        ) : (
          <ul
            style={listStyle}
            role="listbox"
            aria-label="Notes"
            aria-activedescendant={selectedId ? `note-${selectedId}` : undefined}
            tabIndex={0}
            onKeyDown={handleListKeyDown}
            onFocus={() => setListFocused(true)}
            onBlur={() => setListFocused(false)}
          >
            {notes.map((note) => {
              const isSelected = note.id === selectedId;
              const title = noteTitle(note);
              const snippet = noteSnippet(note);
              return (
                <li
                  key={note.id}
                  id={`note-${note.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelectedId(note.id)}
                  style={{
                    position: "relative",
                    padding: "9px 12px",
                    cursor: "pointer",
                    borderBottom: `1px solid ${theme.palette.border}`,
                    background: isSelected ? `${accent}22` : "transparent",
                    color: theme.palette.textPrimary,
                  }}
                >
                  {isSelected && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        background: accent,
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {title || "New Note"}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      fontSize: 12,
                      marginTop: 2,
                      color: theme.palette.textSecondary,
                    }}
                  >
                    <span style={{ flexShrink: 0 }}>
                      {relativeTime(note.updatedAt)}
                    </span>
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {snippet || (title ? "" : "No additional text")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div style={editorStyle}>
        {selected ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderBottom: `1px solid ${theme.palette.border}`,
                color: theme.palette.textSecondary,
                fontSize: 11,
              }}
            >
              <span>{relativeTime(selected.updatedAt)}</span>
              <button
                type="button"
                aria-label="Delete note"
                title="Delete note"
                onClick={() => handleDelete(selected.id)}
                style={iconButtonStyle}
              >
                <TrashGlyph />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              aria-label="Note body"
              value={selected.body}
              placeholder="Start writing. The first line becomes the title."
              onChange={(event) => handleEdit(event.target.value)}
              onFocus={() => setEditorFocused(true)}
              onBlur={() => setEditorFocused(false)}
              style={textareaStyle}
              spellCheck
            />
          </>
        ) : (
          <div style={emptyStyle}>
            <NotesIcon size={32} />
            <span>Select a note, or create one.</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Compose / new-note glyph (Lucide square-pen), stroke only. */
function NewNoteGlyph() {
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
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Trash glyph (Lucide trash-2), stroke only. */
function TrashGlyph() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export const notesApp: App = {
  id: "notes",
  name: "Notes",
  tagline: "Plain-text scratchpad",
  accent: "#f59e0b",
  icon: NotesIcon,
  defaultBounds: { w: 680, h: 460 },
  content: NotesContent,
};
