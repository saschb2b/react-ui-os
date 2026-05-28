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
  type RecentEntry,
} from "./recents";

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function entryToItem(entry: RecentEntry): ExplorerItem {
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    timestamp: entry.createdAt,
    subtitle: formatTimestamp(entry.createdAt),
    icon: "📄",
  };
}

export function RecentsFolder() {
  const { storage } = useDesktopContext();
  const [entries, setEntries] = useState<RecentEntry[]>(() =>
    listRecents(storage),
  );

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
      emptyMessage="No recents yet. Use the Hello app to add one."
      actions={[
        {
          id: "delete",
          label: "Delete",
          danger: true,
          onClick: (selected) => {
            for (const item of selected) deleteRecent(storage, item.id);
          },
        },
      ]}
    />
  );
}
