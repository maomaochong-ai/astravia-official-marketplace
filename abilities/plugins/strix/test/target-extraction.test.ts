import { describe, expect, it } from "vitest";
import { extractTargets, newTargets } from "../src/domain/target-extraction";

/**
 * 从对话里认目标（见 domain/target-extraction.ts）。
 *
 * 判据只有一条：认出来的东西得是"这一轮真的在打的东西"。宁可少认一个，
 * 也不要把 `node.js`、`1.2.3`、`app.test.ts` 塞进目标清单——它们会让人以为测的是别处。
 */

const values = (text: string): string[] => extractTargets(text).map((target) => target.value);

describe("what a person says becomes a target", () => {
	it("takes a bare domain", () => {
		expect(values("帮我测一下 staging.example.com 的登录")).toEqual(["staging.example.com"]);
	});

	it("takes a URL and keeps its scheme", () => {
		expect(values("目标是 https://app.example.com/orders?page=2")).toEqual(["https://app.example.com"]);
	});

	it("keeps a non-default port on a URL but not on a bare host", () => {
		expect(values("打 https://a.example.com:8443/x")).toEqual(["https://a.example.com:8443"]);
		expect(values("a.example.com:8443")).toEqual(["a.example.com"]);
	});

	it("takes IPv4 and CIDR", () => {
		expect(values("扫 10.0.0.5 和 192.168.0.0/24")).toEqual(["10.0.0.5", "192.168.0.0/24"]);
	});

	it("de-duplicates and keeps the order people mentioned them", () => {
		expect(values("先 a.example.com 再 b.example.com 又回到 a.example.com")).toEqual(["a.example.com", "b.example.com"]);
	});

	it("reads a command the user pasted", () => {
		expect(values("nmap -sV -p- 10.0.0.5 && curl https://api.example.com/login")).toEqual([
			"https://api.example.com",
			"10.0.0.5",
		]);
	});
});

describe("what is not a target", () => {
	it("ignores loopback and wildcard binds", () => {
		expect(values("监听 127.0.0.1:8080 与 0.0.0.0")).toEqual([]);
		expect(values("localhost")).toEqual([]);
	});

	it("ignores file names that look like hosts", () => {
		expect(values("看 src/app.test.ts 和 package.json")).toEqual([]);
		expect(values("build/main.js")).toEqual([]);
	});

	it("ignores versions and package names", () => {
		expect(values("升级到 1.2.3，用的是 node.js 与 react 19")).toEqual([]);
	});

	it("ignores dotted tokens whose suffix is not a real TLD", () => {
		expect(values("strix_exec 的 handler 在 lib。foo.qqq 不是主机")).toEqual([]);
	});

	it("has nothing to say about a short or empty string", () => {
		expect(values("")).toEqual([]);
		expect(values("ok")).toEqual([]);
	});
});

describe("declared targets win over derived ones", () => {
	it("hides a candidate that already exists in scope", () => {
		const derived = extractTargets("测 staging.example.com 和 api.example.com");
		// 声明里已经覆盖了前者：候选只留后者，否则同一个主机在清单里出现两次。
		expect(newTargets(derived, ["staging.example.com"]).map((target) => target.value)).toEqual(["api.example.com"]);
	});

	it("treats a declared URL and a derived host as the same thing", () => {
		const derived = extractTargets("https://app.example.com/login");
		expect(newTargets(derived, ["app.example.com"])).toEqual([]);
	});
});
