import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "happy-dom",
		// `globals` is what lets @testing-library/react register its automatic
		// cleanup; without it every render leaks into the next test.
		globals: true,
		include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
	},
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
});
