import { defineConfig } from "vitest/config";

export default defineConfig({
	// The SDK is linked from `.tooling/` in this repo and carries its own React.
	// Two copies put `ReactCurrentDispatcher` in a second module, and every hook
	// read dies with "Cannot read properties of null (reading 'useContext')".
	// Module Federation shares one React at runtime, so the test env must too.
	resolve: {
		dedupe: ["react", "react-dom"],
	},
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
