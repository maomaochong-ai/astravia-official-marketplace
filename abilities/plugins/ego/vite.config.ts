import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		astraviaPluginFederation({
			name: "ego",
			entry: "./src/index.ts",
		}),
	],
});
