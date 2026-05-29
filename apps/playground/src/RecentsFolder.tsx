import { useEffect, useState } from "react";
import {
  FileExplorer,
  useDesktopContext,
  type ExplorerItem,
} from "@react-ui-os/desktop";
import {
  deleteRecent,
  listRecents,
  RECENTS_STORAGE_KEY,
  renameRecent,
  type RecentEntry,
} from "./recents";

function entryToItem(entry: RecentEntry): ExplorerItem {
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    timestamp: entry.createdAt,
    icon: "📄",
  };
}

export function RecentsFolder() {
  const { storage } = useDesktopContext();
  const [entries, setEntries] = useState<RecentEntry[]>(() => listRecents(storage));

  useEffect(() => {
    const refresh = () => {
      setEntries(listRecents(storage));
    };
    refresh();
    const unsubscribe = storage.subscribe((key) => {
      if (key === RECENTS_STORAGE_KEY) refresh();
    });
    return unsubscribe;
  }, [storage]);

  const items = entries.map(entryToItem);

  return (
    <FileExplorer
      items={items}
      emptyState={
        <div
          style={{
            padding: "40px 20px",
            display: "flex",
            justifyContent: "center",
            opacity: 0.6,
            fontSize: 12,
          }}
        >
          No recents yet. Use the Hello app to add one.
        </div>
      }
      onRename={(item, newName) => {
        renameRecent(storage, item.id, newName);
      }}
      actions={[
        {
          id: "delete",
          label: "Delete",
          danger: true,
          shortcut: "⌫",
          onClick: (selected) => {
            for (const item of selected) deleteRecent(storage, item.id);
          },
        },
      ]}
    />
  );
}
