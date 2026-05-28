import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";

// GitHub Pages deploy. Change `site` and drop `base` once a custom domain
// is wired up via a CNAME file. The workflow at .github/workflows/docs.yml
// reads neither — it just builds with these values baked in.
const SITE = process.env.ASTRO_SITE ?? "https://saschb2b.github.io";
const BASE = process.env.ASTRO_BASE ?? "/react-ui-os";

// https://astro.build/config
export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: [
    starlight({
      title: "react-ui-os",
      description:
        "A React component library that ships a working OS-style desktop in one line.",
      logo: undefined,
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/saschb2b/react-ui-os",
        },
      ],
      customCss: ["./src/styles/brand.css"],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", link: "/introduction/" },
            { label: "Installation", link: "/installation/" },
            { label: "Quickstart", link: "/quickstart/" },
          ],
        },
        {
          label: "Components",
          items: [{ autogenerate: { directory: "components" } }],
        },
        {
          label: "API",
          items: [{ autogenerate: { directory: "api" } }],
        },
        {
          label: "Themes",
          items: [{ autogenerate: { directory: "themes" } }],
        },
        {
          label: "Showcase",
          items: [
            { label: "Showcase", link: "/showcase/" },
            { label: "Playground", link: "/playground/" },
          ],
        },
        {
          label: "Releases",
          items: [{ label: "Changelog", link: "/changelog/" }],
        },
      ],
      components: {
        // Use Starlight defaults for now. Layout slots will be overridden
        // here once we want the LivePreview to appear in the head of the
        // landing page automatically.
      },
    }),
    react(),
    mdx(),
  ],
  vite: {
    resolve: {
      conditions: ["source"],
    },
  },
  server: {
    port: 4321,
  },
});
