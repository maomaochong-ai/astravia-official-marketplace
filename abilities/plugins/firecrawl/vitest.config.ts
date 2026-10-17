import { defineConfig } from "vitest/config";

export default defineConfig({
	// The SDK is linked from the host checkout, which has its own React. Without
	// dedupe the renderer and the SDK end up on two copies and hooks throw.
	resolve: { dedupe: ["react", "react-dom"] },
	test: {
		environment: "happy-dom",
		include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
	},
});
