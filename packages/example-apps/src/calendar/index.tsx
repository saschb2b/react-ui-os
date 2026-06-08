import type { App, AppContentProps } from "@react-ui-os/core";
import { CalendarIcon } from "@react-ui-os/icons";
import { CalendarFluentIcon } from "@react-ui-os/icons";
import { CalendarContent } from "./CalendarContent";

function Content({ appId }: AppContentProps) {
  return <CalendarContent appId={appId} />;
}

export const calendarApp: App = {
  id: "calendar",
  name: "Calendar",
  tagline: "Month at a glance",
  accent: "#ef4444",
  icon: CalendarIcon,
  icons: { fluent: CalendarFluentIcon },
  defaultBounds: { w: 720, h: 600 },
  content: Content,
};

export { CALENDAR_STORAGE_KEY } from "./calendar-store";
