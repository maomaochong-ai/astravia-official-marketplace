import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 服务的两个上限（1.4.1）。
 *
 *  1. **日志**：原来是无限增长的数组，每条工具事件 push 一次。一个跑几小时的评估
 *     就是几十万条，而对外只用最后 40 条 —— 真实的内存泄漏。
 *  2. **请求体**：`readBody` 原本把整个 body 读进内存再做 JSON.parse。虽然只监听
 *     127.0.0.1，但没有上限仍然是一个 OOM 的口子（一次误发的巨大 payload 就能把服务打掉）。
 *
 * 这两条都是"平时看不出来、出事时很难查"的类型，所以用源码断言钉住形状
 * （服务入口 import 就会 listen，不适合在单测里直接 import）。
 */

const plugin = resolve(process.cwd());
const main = readFileSync(join(plugin, "src/service/main.ts"), "utf8");

describe("the service log is bounded", () => {
	it("trims to LOG_LIMIT after every push", () => {
		expect(main).toMatch(/const LOG_LIMIT = \d+;/);
		expect(main).toMatch(/log\.push\(payload\);[\s\S]{0,200}log\.splice\(0, log\.length - LOG_LIMIT\)/);
	});

	it("still serves the tail the panel reads", () => {
		expect(main).toContain("logTail: log.slice(-40)");
	});
});

describe("request bodies are bounded", () => {
	it("stops accumulating past the cap", () => {
		expect(main).toMatch(/const MAX_BODY_BYTES = \d+ \* 1024 \* 1024;/);
		expect(main).toMatch(/if \(bytes > MAX_BODY_BYTES\) break;/);
	});

	it("keeps readBody async (the cap must not turn it into a blocking read)", () => {
		expect(main).toMatch(/async function readBody\(/);
	});
});

describe("the stream reconnects instead of going quiet", () => {
	const client = readFileSync(join(plugin, "src/domain/bridge-client.ts"), "utf8");

	it("re-creates the EventSource on error", () => {
		expect(client).toContain("next.onerror");
		expect(client).toMatch(/next\.close\(\);[\s\S]{0,400}connect\(\)/);
	});

	it("re-resolves the address instead of reusing the stale one", () => {
		// 重连必须重新走 baseUrl()：服务重启会换端口。
		const connect = client.slice(client.indexOf("const connect = async"), client.indexOf("void connect()"));
		expect(connect).toContain("await baseUrl()");
	});

	it("caps the backoff so a dead service does not cause a hot loop", () => {
		expect(client).toMatch(/Math\.min\(10_000, 500 \* 2 \*\*/);
	});
});

describe("the audit left no dead weight behind", () => {
	it("has a single TRACE_LIMIT, in the projection layer", () => {
		const hook = readFileSync(join(plugin, "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");
		const traceLog = readFileSync(join(plugin, "src/domain/trace-log.ts"), "utf8");
		expect(hook).not.toContain("const TRACE_LIMIT");
		expect(traceLog).toContain("export const TRACE_LIMIT");
	});

	it("ships no stray probe script in the plugin tree", () => {
		// 上一轮的量测脚本放在仓库根的 .tmp（已 gitignore），插件目录里不该出现。
		expect(existsSync(join(plugin, "scripts/bench-state.mjs"))).toBe(false);
		expect(existsSync(join(plugin, "test/zz-bench.test.ts"))).toBe(false);
	});
});
