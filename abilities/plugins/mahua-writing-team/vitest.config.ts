import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// 纯逻辑测试：路由、状态机、验签、服务层、清单守卫。没有组件测试，因此不需要 DOM 环境；
		// happy-dom 会把 import.meta.url 改写成 /@fs/...，让 guard 测试读不到源码文件。
		environment: "node",
		include: ["test/**/*.test.ts"],
	},
});
