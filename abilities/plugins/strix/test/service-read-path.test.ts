import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 服务端热点（1.4.1）：`/api/state` 不许在请求路径里做昂贵探测。
 *
 * 实测（同一台机器，service 冷启动）：
 *   dockerReady()          2281 ms
 *   imagePresent()          981 ms
 *   resolveEnvironment()   3104 ms
 *   probeToolchain()       4590 ms
 *   loadIndex()             150 ms
 * 而面板的 `refresh()` 在**每次工具调用结束**都会打一次 `/api/state`：
 *   优化前 /api/state 稳定 2.6s；优化后中位 21ms（首次仍付一次冷探测）。
 *
 * 这条测试守的是"结构"：`/api/state` 只能从缓存取，不能直接调探测函数。
 * 数字由 `.tmp/bench-state.mjs` 量，不写进断言（机器差异会让绝对时间变噪声）。
 */

const plugin = resolve(process.cwd());
const main = readFileSync(join(plugin, "src/service/main.ts"), "utf8");

/** 取出某个路径处理块（到下一个 `if (url.pathname` 或块结束）。 */
function endpoint(pathname: string): string {
	const start = main.indexOf(`url.pathname === "${pathname}"`);
	if (start < 0) return "";
	const next = main.indexOf("if (url.pathname ===", start + 10);
	return main.slice(start, next > 0 ? next : start + 4000);
}

describe("/api/state reads caches, never the machine", () => {
	const state = endpoint("/api/state");

	it("goes through the cached environment, not resolveEnvironment()", () => {
		expect(state).not.toContain("resolveEnvironment(");
		expect(main).toContain("environmentCache");
	});

	it("goes through the cached skill index, not loadIndex()", () => {
		expect(state).not.toContain("loadIndex(");
		expect(main).toContain("skillsIndexCache.get()");
	});

	it("does not spawn the toolchain probe on the read path", () => {
		// environment() 内部走 toolchainCache；请求块本身不该出现 probeToolchain。
		expect(state).not.toContain("probeToolchain(");
		expect(main).toContain("toolchainCache.get()");
	});

	it("warms the cache at startup so the first read is not the slow one", () => {
		const listen = main.slice(main.indexOf("server.listen("));
		expect(listen.slice(0, 400)).toContain("environmentCache.get()");
	});
});

describe("/api/environment is the explicit refresh", () => {
	it("invalidates before answering, because the caller asked for the truth now", () => {
		const env = endpoint("/api/environment");
		expect(env).toContain("environmentCache.invalidate()");
		expect(env).toContain("environmentCache.get()");
	});

	it("is still single-flight (invalidate is not a licence to fan out)", () => {
		// invalidate 之后仍然走 get()，而 get 有单飞；这里确认没有绕过它直接 probe。
		const env = endpoint("/api/environment");
		expect(env).not.toContain("resolveEnvironment(");
	});
});

describe("the panel side coalesces refreshes", () => {
	const hook = readFileSync(join(plugin, "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");

	it("has one in-flight refresh and a queued flag", () => {
		expect(hook).toContain("const inFlight = useRef(false)");
		expect(hook).toContain("const queued = useRef(false)");
		expect(hook).toMatch(/if \(inFlight\.current\) \{[\s\S]*?queued\.current = true;[\s\S]*?return;/);
	});

	it("only shows connecting on the first load", () => {
		expect(hook).toContain("loadedOnce.current");
		expect(hook).toMatch(/if \(!loadedOnce\.current\) setBoot/);
	});
});
