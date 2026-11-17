import tailwindcss from "@tailwindcss/vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
	// Relative base (as in the other plugins) so the MF manifest and remoteEntry
	// are emitted next to the assets instead of at an absolute path.
	base: "./",
	plugins: [
		tailwindcss(),
		astraviaPluginFederation({
			name: "todesk",
			entry: "./src/index.tsx",
		}),
	],
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
});


