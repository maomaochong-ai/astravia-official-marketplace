import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

/**
 * Visual harness: mount the real panel in a plain page at exactly the panel's width,
 * so the layout can be looked at instead of reasoned about. Never shipped — this
 * config is outside `vite.config.ts`, and nothing here is imported by the plugin.
 */
export default defineConfig({
	root: resolve(import.meta.dirname),
	plugins: [tailwindcss()],
	resolve: {
		dedupe: ["react", "react-dom"],
		alias: {
			"@astravia-org/plugin-sdk": resolve(import.meta.dirname, "../node_modules/@astravia-org/plugin-sdk/src/index.ts"),
		},
	},
	server: { port: 5199, strictPort: true },
});
