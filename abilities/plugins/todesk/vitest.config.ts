import { defineConfig } from "vitest/config";

export default defineConfig({
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
	test: {
		environment: "jsdom",
		include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
	},
});
