import { defineConfig } from "vitest/config";

export default defineConfig({
	// The plugin builds with the automatic JSX runtime; component tests must use
	// the same runtime or they fail on a missing global `React`.
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
	test: {
		environment: "jsdom",
		include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
	},
});
