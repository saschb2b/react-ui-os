// Prepend the configured base path to root-absolute links in markdown content.
// Astro rewrites its own routing and asset URLs for the deploy base, but it
// does not touch hardcoded `/foo` links written in markdown. On a based deploy
// (GitHub Pages at /react-ui-os) every `[x](/y)` would resolve to the domain
// root and 404. This rewrites them at build time so doc content stays
// base-agnostic. External links, protocol-relative links, anchors, and links
// already under the base are left alone. Only markdown content runs through
// this; Starlight's own chrome (sidebar, prev/next) already carries the base.

export function rehypeBaseLinks(base) {
  const prefix = (base ?? "/").replace(/\/$/, "");

  const visit = (node) => {
    if (
      node.type === "element" &&
      node.tagName === "a" &&
      node.properties &&
      typeof node.properties.href === "string"
    ) {
      const href = node.properties.href;
      if (
        href.startsWith("/") &&
        !href.startsWith("//") &&
        href !== prefix &&
        !href.startsWith(`${prefix}/`)
      ) {
        node.properties.href = `${prefix}${href}`;
      }
    }
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };

  return () => (tree) => {
    if (prefix) visit(tree);
  };
}
