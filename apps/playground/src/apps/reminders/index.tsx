import type { App, AppContentProps } from "@react-ui-os/core";
import { RemindersIcon } from "./icon";
import { RemindersContent } from "./RemindersContent";

function Content({ appId }: AppContentProps) {
  return <RemindersContent appId={appId} />;
}

export const remindersApp: App = {
  id: "reminders",
  name: "Reminders",
  tagline: "Track what's left to do",
  accent: "#fb7185",
  icon: RemindersIcon,
  defaultBounds: { w: 520, h: 560 },
  content: Content,
};

export { REMINDERS_STORAGE_KEY } from "./reminders-store";
