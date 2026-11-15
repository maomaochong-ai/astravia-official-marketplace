import { describe, expect, it } from "vitest";
import { digestAnswer, digestAsk, hasDigest } from "../src/domain/conversation-digest";

/**
 * 对话摘要的规则（见 domain/conversation-digest.ts 的注释）。
 *
 * 这里守的是"面板留什么"：用户的诉求一行、agent 的结论几句、寒暄与过渡不留。
 * 它不是文本处理库的测试——每一条都对应面板上的一行字。
 */

describe("the user's ask becomes one line", () => {
	it("collapses a multi-line prompt", () => {
		expect(digestAsk("帮我测一下\n\n  staging.example.com  \n顺便看看 /api/orders")).toBe(
			"帮我测一下 staging.example.com 顺便看看 /api/orders",
		);
	});

	it("drops a pasted code fence instead of showing it", () => {
		// 粘一段日志进来是常见动作；面板要的是"他要干什么"，不是那三百行。
		const ask = digestAsk("看这个报错\n```\nTypeError: boom\n  at foo\n```\n然后修掉");
		expect(ask).toBe("看这个报错 然后修掉");
	});

	it("clips a long ask at a readable boundary", () => {
		const ask = digestAsk(`${"范围描述".repeat(40)}`);
		expect(ask!.length).toBeLessThanOrEqual(97);
		expect(ask!.endsWith("…")).toBe(true);
	});

	it("has nothing to say about whitespace", () => {
		expect(digestAsk("   \n\t ")).toBeUndefined();
	});
});

describe("the answer keeps conclusions, not prose", () => {
	it("keeps a line that names a finding", () => {
		const points = digestAnswer("先看一下登录页。\n发现一处 IDOR，影响 /api/orders/42，severity high。");
		expect(points.join(" ")).toContain("IDOR");
		// 过渡句不留：它没有信息。
		expect(points.join(" ")).not.toContain("先看一下登录页");
	});

	it("keeps hosts, commands and paths", () => {
		const points = digestAnswer(
			["扫描完成。", "nmap -sV -p- 10.0.0.5 返回 443/tcp open", "报告在 /reports/strix/a.md"].join("\n"),
		);
		expect(points.some((line) => line.includes("10.0.0.5"))).toBe(true);
		expect(points.some((line) => line.includes("/reports/strix"))).toBe(true);
	});

	it("drops filler and acknowledgement", () => {
		expect(hasDigest("好的，收到。")).toBe(false);
		expect(digestAnswer("Sure\nOkay")).toEqual([]);
	});

	it("falls back to the first lines when nothing is a conclusion", () => {
		// 一句 20 字、没有数字也没有路径的回答，也该在面板上留个痕迹。
		const points = digestAnswer("这是一段普通的说明文字，没有数字也没有路径");
		expect(points).toHaveLength(1);
		expect(points[0]).toContain("普通的说明文字");
	});

	it("never exceeds the per-turn budget", () => {
		const many = Array.from({ length: 30 }, (_, index) => `发现 ${index} 处问题：/api/${index}`).join("\n");
		expect(digestAnswer(many).length).toBeLessThanOrEqual(6);
	});

	it("does not repeat the same line twice", () => {
		const points = digestAnswer("发现 IDOR：/api/orders\n发现 IDOR：/api/orders\n发现 IDOR：/api/orders");
		expect(points).toHaveLength(1);
	});

	it("strips markdown decoration so the line reads as text", () => {
		const points = digestAnswer("## 结论\n- **高危**：`/api/orders` 可越权读取");
		expect(points.every((line) => !line.startsWith("#") && !line.includes("`") && !line.includes("**"))).toBe(true);
		expect(points.join(" ")).toContain("高危");
	});
});
