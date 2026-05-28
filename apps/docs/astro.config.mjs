import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: "https://react-ui-os.dev",
  integrations: [react(), mdx()],
  vite: {
    // Match the playground: pick the `source` condition so workspace
    // packages resolve to src/ during dev, no rebuild needed.
    resolve: {
      conditions: ["source"],
    },
  },
  server: {
    port: 4321,
  },
});
