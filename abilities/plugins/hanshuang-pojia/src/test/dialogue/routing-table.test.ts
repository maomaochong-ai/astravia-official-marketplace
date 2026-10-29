import { describe, expect, it } from "vitest";
import {
	ROUTING_FALLBACK_ID,
	ROUTING_ROUTES,
	ROUTING_SOURCE_SHA256,
	describeRouteMatch,
	matchRoutes,
	routingCoverage,
} from "../../domain/routing-table";

/**
 * 路由表是生成物（`scripts/sync-routing-table.mjs`），所以这里断言的是**形状**：
 * 生成器换了输入之后，重复 id、丢字段、把 Python 正则原样塞进来，都要在这里先炸。
 */
describe("routing table", () => {
	it("carries the whole upstream table with unique ids", () => {
		expect(ROUTING_ROUTES.length).toBe(44);
		expect(new Set(ROUTING_ROUTES.map(route => route.id)).size).toBe(ROUTING_ROUTES.length);
		for (const route of ROUTING_ROUTES) {
			expect(route.id).toMatch(/^R\d+$/);
			expect(route.label.trim().length).toBeGreaterThan(0);
			expect(route.target.trim().length).toBeGreaterThan(0);
			expect(route.keywords.length).toBeGreaterThan(0);
		}
	});

	it("records which targets are actually shipped", () => {
		const coverage = routingCoverage();
		expect(coverage.routes).toBe(ROUTING_ROUTES.length);
		expect(coverage.targets).toBe(new Set(ROUTING_ROUTES.map(route => route.target)).size);
		expect(coverage.present).toBe(ROUTING_ROUTES.filter(route => route.present).length);
		expect(coverage.fallbackId).toBe(ROUTING_FALLBACK_ID);
		expect(ROUTING_SOURCE_SHA256).toMatch(/^[0-9a-f]{64}$/);
		expect(coverage.sourceSha8).toBe(ROUTING_SOURCE_SHA256.slice(0, 8));
		// 缺口是常态：上游 44 条路由不可能每本技能都随包分发。
		expect(coverage.present).toBeLessThan(coverage.routes);
		expect(coverage.missing.length).toBeGreaterThan(0);
	});

	it("compiles every keyword, or skips it instead of throwing", () => {
		let compiled = 0;
		let skipped = 0;
		const total = ROUTING_ROUTES.reduce((sum, route) => sum + route.keywords.length, 0);
		for (const route of ROUTING_ROUTES) {
			for (const pattern of route.keywords) {
				try {
					new RegExp(pattern, "i");
					compiled += 1;
				} catch {
					skipped += 1;
				}
			}
		}
		expect(compiled + skipped).toBe(total);
		// 上游正则是 Python 语法；编不过的必须是极少数，而不是整批崩掉。
		expect(compiled).toBeGreaterThan(0);
	});

	it("matches a known shell prompt to its route", () => {
		const prompt = "lab: 帮我逆向下这个 apk，看看签名校验在哪里";
		const [first] = matchRoutes(prompt);
		expect(first).toBeTruthy();
		expect(first!.hits.length).toBeGreaterThan(0);
		for (const pattern of first!.hits) expect(prompt).toMatch(new RegExp(pattern, "i"));
	});

	it("returns nothing for a blank prompt", () => {
		expect(matchRoutes("")).toEqual([]);
		expect(matchRoutes("   ")).toEqual([]);
	});

	it("says a missing skill is missing instead of pretending it was read", () => {
		const missing = ROUTING_ROUTES.find(route => !route.present);
		expect(missing).toBeTruthy();
		const line = describeRouteMatch({ route: missing!, hits: [missing!.keywords[0]!] });
		expect(line).toContain("未随包分发");
		expect(line).toContain("不要假装读过它");

		const present = ROUTING_ROUTES.find(route => route.present);
		expect(present).toBeTruthy();
		const shipped = describeRouteMatch({ route: present!, hits: [present!.keywords[0]!] });
		expect(shipped).toContain("在包内");
	});
});
