// @ts-nocheck — plugin-vite carries its own vite instance in dev; the rollup hook
// types differ from this package's vite. IDE-only noise, the build is unaffected.
import tailwindcss from "@tailwindcss/vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
	base: "./",
	build: {
		rollupOptions: {
			output: {
				assetFileNames: "assets/[name]-[hash][extname]",
				entryFileNames: "assets/[name]-[hash].js",
				chunkFileNames: "assets/[name]-[hash].js",
			},
		},
	},
	plugins: [
		tailwindcss(),
		astraviaPluginFederation({
			name: "firecrawl",
			entry: "./src/index.tsx",
		}),
	],
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
});
