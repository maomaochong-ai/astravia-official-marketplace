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
		// 测试与生产代码分开放在插件根目录的 test/（不走 src/）：
		// 市场工具把 `src/test/**` 视作"纯展示改动"，而我们更需要一眼看出测试在哪。
		include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
	},
});
