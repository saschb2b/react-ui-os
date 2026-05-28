import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

/**
 * Starlight reads documentation from this collection. Files live under
 * `src/content/docs/` as `.md` or `.mdx`. The schema gives every page
 * frontmatter for `title`, `description`, `sidebar`, plus the splash
 * template's `hero` block.
 */
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema(),
  }),
};
