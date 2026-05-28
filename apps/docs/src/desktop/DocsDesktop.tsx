import { Desktop } from "@react-ui-os/desktop";
import { createMintablesTheme } from "@react-ui-os/theme-mintables";
import { docsApps } from "./apps";

const theme = createMintablesTheme({ wallpaperSrc: "/wallpaper.jpg" });

/**
 * Client-only React island that boots the desktop. The Astro layout renders
 * the MDX content statically for crawlers; once this island hydrates, the
 * desktop chrome takes over and the page reads as a real OS environment.
 *
 * The dual render is intentional: a no-JS visitor (search engine, screen
 * reader, anyone behind a strict CSP) still sees the content. A JS-enabled
 * visitor sees the library running.
 */
export default function DocsDesktop() {
  return <Desktop apps={docsApps} theme={theme} brand="react-ui-os.dev" />;
}
