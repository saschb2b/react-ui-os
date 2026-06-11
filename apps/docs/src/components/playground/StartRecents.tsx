import { useEffect } from "react";
import type { WindowPayload } from "@react-ui-os/core";
import { useWindowManager } from "@react-ui-os/core";
import {
  nextCascadeIndex,
  pickInitialBounds,
  registerRecentsSource,
  useApps,
  useDesktopContext,
  useTheme,
} from "@react-ui-os/desktop";
import { listNotes, noteTitle } from "@react-ui-os/example-apps";
import { listRecents } from "./recents";

/**
 * Feeds the Start menu's Recent section (the Windows launcher) from the two
 * stores this demo already persists: Notes documents (newest edits first) and
 * the Recents folder entries. Activating a note opens the Notes app;
 * activating a folder entry opens the Recents folder. Headless; mount inside
 * <Desktop>.
 */
export function StartRecents() {
  const { storage } = useDesktopContext();
  const apps = useApps();
  const theme = useTheme();
  const { state, openWindow } = useWindowManager();

  useEffect(() => {
    const open = (payload: WindowPayload) => {
      openWindow(
        payload,
        pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
      );
    };
    const notesAccent = apps.find((a) => a.id === "notes")?.accent;
    const unsubNotes = registerRecentsSource("notes", () =>
      listNotes(storage)
        .slice(0, 4)
        .map((note) => ({
          id: note.id,
          name: noteTitle(note) || "New Note",
          timestamp: note.updatedAt,
          kindLabel: "Note",
          accent: notesAccent,
          onActivate: () => {
            open({ kind: "app", appId: "notes" });
          },
        })),
    );
    const unsubFolder = registerRecentsSource("recents-folder", () =>
      listRecents(storage)
        .slice(0, 6)
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          timestamp: entry.createdAt,
          kindLabel: entry.kind,
          accent: "#6b8afd",
          onActivate: () => {
            open({ kind: "system", systemId: "recents" });
          },
        })),
    );
    return () => {
      unsubNotes();
      unsubFolder();
    };
  }, [storage, apps, theme, state, openWindow]);

  return null;
}
