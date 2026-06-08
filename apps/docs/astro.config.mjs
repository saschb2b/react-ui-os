import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";
import { rehypeBaseLinks } from "./plugins/rehype-base-links.mjs";

// Resolve every @react-ui-os/* workspace package to its TypeScript source.
// The docs site is built straight from source (the deploy workflow runs
// `pnpm --filter docs build` without building the libraries first), so the
// `dist/` directories don't exist on a clean checkout. The `source` export
// condition handles this for the dev server, but the production build's
// commonjs resolver ignores it and falls back to the missing `dist/index.js`.
// An explicit alias is honored by every resolver in both dev and build.
const PACKAGES = [
  "core",
  "desktop",
  "demo",
  "icons",
  "example-apps",
  "theme-macos",
  "theme-ubuntu",
  "theme-windows",
];
const sourceAliases = PACKAGES.map((name) => ({
  find: `@react-ui-os/${name}`,
  replacement: fileURLToPath(
    new URL(`../../packages/${name}/src/index.ts`, import.meta.url),
  ),
}));

// GitHub Pages deploy. Change `site` and drop `base` once a custom domain
// is wired up via a CNAME file. The workflow at .github/workflows/docs.yml
// reads neither: it just builds with these values baked in.
const SITE = process.env.ASTRO_SITE ?? "https://saschb2b.github.io";
const BASE = process.env.ASTRO_BASE ?? "/react-ui-os";

// Social card image used by every page. Using the macOS desktop wallpaper as
// the stand-in until a dedicated branded card is rendered, see Changelog
// roadmap. The image lives at apps/docs/public/macos-wallpaper.jpg.
const SOCIAL_IMAGE = `${SITE}${BASE}/macos-wallpaper.jpg`;

// https://astro.build/config
export default defineConfig({
  site: SITE,
  base: BASE,
  // The dev toolbar overlaps the docs UI in local dev. Turn it off.
  devToolbar: { enabled: false },
  // Rewrite root-absolute markdown links to carry the deploy base so they work
  // on GitHub Pages (served under /react-ui-os). Content stays base-agnostic.
  markdown: { rehypePlugins: [rehypeBaseLinks(BASE)] },
  integrations: [
    starlight({
      title: "react-ui-os",
      description:
        "A React component library that ships a working OS-style desktop in one line.",
      logo: undefined,
      head: [
        // Open Graph: Slack, LinkedIn, iMessage.
        { tag: "meta", attrs: { property: "og:type", content: "website" } },
        { tag: "meta", attrs: { property: "og:image", content: SOCIAL_IMAGE } },
        { tag: "meta", attrs: { property: "og:image:width", content: "2560" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "1440" } },
        {
          tag: "meta",
          attrs: { property: "og:image:alt", content: "react-ui-os desktop wallpaper" },
        },
        // Twitter / X.
        {
          tag: "meta",
          attrs: { name: "twitter:card", content: "summary_large_image" },
        },
        { tag: "meta", attrs: { name: "twitter:image", content: SOCIAL_IMAGE } },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image:alt",
            content: "react-ui-os desktop wallpaper",
          },
        },
        // Theme color picks up the dock accent in browser chrome.
        { tag: "meta", attrs: { name: "theme-color", content: "#7c66f5" } },
        // Toggle `rui-at-top` on the header at scroll 0 so it blends into the
        // page at the top and frosts in on scroll (see brand.css). A script, not
        // pure CSS, so every browser gets it, not only ones that support
        // scroll-driven animations.
        {
          tag: "script",
          content:
            "(function(){function u(){var h=document.querySelector('header.header');if(h)h.classList.toggle('rui-at-top',(window.scrollY||document.documentElement.scrollTop||0)<8);}if(document.readyState!=='loading')u();else document.addEventListener('DOMContentLoaded',u);window.addEventListener('scroll',u,{passive:true});window.addEventListener('load',u);})();",
        },
      ],
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
          label: "App Store",
          items: [{ autogenerate: { directory: "app-store" } }],
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
          label: "Architecture",
          items: [{ autogenerate: { directory: "architecture" } }],
        },
        {
          label: "Recipes",
          items: [{ autogenerate: { directory: "recipes" } }],
        },
        {
          label: "Use cases",
          items: [{ autogenerate: { directory: "use-cases" } }],
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
        // The landing (the only splash page) renders a custom two-column hero
        // with the live, auto-cycling desktop as its centerpiece. Overriding
        // Hero lets it own the hero slot, so the splash template does not also
        // print its default title block above it.
        Hero: "./src/components/LandingHero.astro",
      },
    }),
    react(),
    mdx(),
  ],
  vite: {
    resolve: {
      alias: sourceAliases,
      conditions: ["source"],
    },
  },
  server: {
    port: 4321,
  },
});
