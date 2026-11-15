import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 分层与注释的两条硬边界（1.0.14）。
 *
 * 一、**面板不许 import `src/service/`。** 服务是另一个进程（fs / child_process / docker），
 *    面板是宿主里的 React。任何"面向前端"的东西都该长在 `src/domain/`，两边都从那里拿；
 *    于是依赖方向只有一个：UI → domain ← service。
 *    这条不是洁癖：一旦面板 import 了服务的实现模块，它就会把 node 内置模块带进浏览器包。
 *
 * 二、**代码注释里不写决策文档编号。** 注释要说"为什么这么做"，读者不该为了看懂一行代码
 *    去翻仓库里的第几号文档——而且那份文档改号/删档以后，注释就成了死链。
 *    决策文档仍然是决策文档，只是不往代码里钉编号。
 */

const plugin = resolve(process.cwd());
const walk = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));

const source = walk(join(plugin, "src")).filter((file) => /\.(ts|tsx)$/.test(file));
const ui = source.filter((file) => !file.includes(`${join("src", "service")}`));
const service = source.filter((file) => file.includes(`${join("src", "service")}`));

describe("the panel never reaches into the service implementation", () => {
	it("has no UI file importing src/service", () => {
		const leaks = ui.flatMap((file) =>
			[...readFileSync(file, "utf8").matchAll(/from\s+"([^"]*service\/[^"]*)"/g)].map(
				(match) => `${file.replace(`${plugin}/`, "")} → ${match[1]}`,
			),
		);
		expect(leaks).toEqual([]);
	});

	it("shares shapes through src/domain, which the service imports too", () => {
		// 共享的那部分（MCP 名册）在 domain 里，服务与面板各取一次，不存在第二份定义。
		const domain = readFileSync(join(plugin, "src/domain/mcp-roster.ts"), "utf8");
		expect(domain).toContain("export function normalizeRoster");
		const serviceMain = readFileSync(join(plugin, "src/service/main.ts"), "utf8");
		expect(serviceMain).toContain('from "../domain/mcp-roster"');
		const panel = readFileSync(join(plugin, "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");
		expect(panel).toContain('from "../../../domain/mcp-roster"');
	});

	it("keeps the service as a leaf that only imports downward", () => {
		// 服务可以 import domain / agent / shared；不能 import features（那是 UI）。
		const offenders = service.flatMap((file) =>
			[...readFileSync(file, "utf8").matchAll(/from\s+"([^"]+)"/g)]
				.map((match) => match[1]!)
				.filter((spec) => spec.includes("features/"))
				.map((spec) => `${file.replace(`${plugin}/`, "")} → ${spec}`),
		);
		expect(offenders).toEqual([]);
	});
});

describe("code comments carry reasons, not document numbers", () => {
	const codeFiles = [...source, ...walk(join(plugin, "test")).filter((file) => /\.(ts|tsx|mjs|cjs)$/.test(file))];
	// 令牌拆开写：这个文件自己也要被扫，写全了它就会扫到自己。
	const DOC = ["A", "D", "R"].join("");

	it("mentions no decision-document id anywhere in code", () => {
		const offenders = codeFiles
			.filter((file) => !file.includes("node_modules"))
			.filter((file) => !file.endsWith("dependency-layers.test.ts"))
			.flatMap((file) => (readFileSync(file, "utf8").includes(DOC) ? [file.replace(`${plugin}/`, "")] : []));
		expect(offenders).toEqual([]);
	});

	it("still explains itself once the ids are gone", () => {
		// 去掉编号不等于删掉理由：抽查一段最该有理由的地方。
		const shape = readFileSync(join(plugin, "src/domain/conversation-shape.ts"), "utf8");
		expect(shape).toMatch(/团队会话|team/);
		expect(shape.length).toBeGreaterThan(1200);
	});
});
