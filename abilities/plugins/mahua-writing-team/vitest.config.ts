import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// 默认 node 环境：路由、状态机、验签、服务层、清单守卫都不需要 DOM，而且 happy-dom 会把
		// `import.meta.url` 改写成 /@fs/...，让 guard 测试读不到源码文件。需要 DOM 的组件接线测试
		// 在自己的文件头写 `// @vitest-environment jsdom`，只影响那一个文件。
		environment: "node",
		include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
	},
});
