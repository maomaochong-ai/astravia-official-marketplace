import { describe, expect, it, vi } from "vitest";
import { createProbeCache } from "../src/service/probe-cache";

/**
 * 探测缓存（1.4.1）。
 *
 * 这块存在的唯一理由：`/api/state` 在每次工具调用结束都会被请求一次，而它原本每次都
 * spawn `docker info` + `docker image inspect`（实测 3.1s，本机模式再加 4.6s 的工具链探测）。
 * 三条语义各自都要成立，缺一条就会退化成"更慢"或"更不准"：
 *
 *  1. **TTL**：窗口内直接用旧值（快）；
 *  2. **单飞**：并发请求共享一次探测（不放大）；
 *  3. **force**：用户主动要求时跳过旧值，但仍然单飞（不并发跑十份）。
 */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("TTL", () => {
	it("probes once inside the window", async () => {
		let calls = 0;
		const cache = createProbeCache({ probe: async () => ++calls, ttlMs: 1000 });
		expect(await cache.get()).toBe(1);
		expect(await cache.get()).toBe(1);
		expect(calls).toBe(1);
	});

	it("probes again once the window has passed", async () => {
		let clock = 0;
		let calls = 0;
		const cache = createProbeCache({ probe: async () => ++calls, ttlMs: 1000, now: () => clock });
		expect(await cache.get()).toBe(1);
		clock = 900;
		expect(await cache.get()).toBe(1);
		clock = 1100;
		expect(await cache.get()).toBe(2);
	});

	it("keeps a failure for a shorter time, so a daemon that just started is seen quickly", async () => {
		let clock = 0;
		let answer = { ready: false };
		let calls = 0;
		const cache = createProbeCache({
			probe: async () => {
				calls += 1;
				return answer;
			},
			ttlMs: 8000,
			failureTtlMs: 1000,
			now: () => clock,
			isFailure: (value) => value.ready === false,
		});
		await cache.get();
		clock = 1200; // 超过失败 TTL，但远没到成功 TTL
		await cache.get();
		expect(calls).toBe(2);
		answer = { ready: true };
		clock = 5000;
		await cache.get();
		expect(calls).toBe(3);
		clock = 6000; // 成功后走 8s 窗口
		await cache.get();
		expect(calls).toBe(3);
	});
});

describe("single-flight", () => {
	it("shares one probe between concurrent callers", async () => {
		let calls = 0;
		const cache = createProbeCache({
			probe: async () => {
				calls += 1;
				await delay(20);
				return "v1";
			},
			ttlMs: 1000,
		});
		const results = await Promise.all([cache.get(), cache.get(), cache.get(), cache.get()]);
		expect(results).toEqual(["v1", "v1", "v1", "v1"]);
		expect(calls).toBe(1);
	});

	it("starts a second probe only after the first one settled", async () => {
		let calls = 0;
		const cache = createProbeCache({
			probe: async () => {
				calls += 1;
				await delay(10);
				return calls;
			},
			ttlMs: 1000,
		});
		expect(await cache.get()).toBe(1);
		expect(await cache.get(true)).toBe(2);
		expect(calls).toBe(2);
	});
});

describe("force", () => {
	it("skips the cached value", async () => {
		let calls = 0;
		const cache = createProbeCache({ probe: async () => ++calls, ttlMs: 60_000 });
		await cache.get();
		expect(await cache.get(true)).toBe(2);
	});

	it("still collapses a burst of forced callers into one probe", async () => {
		let calls = 0;
		const cache = createProbeCache({
			probe: async () => {
				calls += 1;
				await delay(15);
				return calls;
			},
			ttlMs: 60_000,
		});
		const burst = await Promise.all([cache.get(true), cache.get(true), cache.get(true)]);
		expect(burst).toEqual([1, 1, 1]);
		expect(calls).toBe(1);
	});

	it("invalidate() makes the next read probe again", async () => {
		let calls = 0;
		const cache = createProbeCache({ probe: async () => ++calls, ttlMs: 60_000 });
		await cache.get();
		cache.invalidate();
		expect(cache.peek()).toBeUndefined();
		expect(await cache.get()).toBe(2);
	});
});

describe("failures are not cached as success", () => {
	it("surfaces the rejection and keeps nothing", async () => {
		const probe = vi.fn().mockRejectedValueOnce(new Error("docker missing")).mockResolvedValueOnce("ok");
		const cache = createProbeCache({ probe, ttlMs: 60_000 });
		await expect(cache.get()).rejects.toThrow("docker missing");
		expect(cache.peek()).toBeUndefined();
		expect(await cache.get()).toBe("ok");
	});
});
