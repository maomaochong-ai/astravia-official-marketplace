import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 面板的入口与密度（ADR 0019，1.0.12）。
 *
 * 原型（.tmp/prototypes/strix-panel-v2.html）里逐入口标了 21 处；这条只钉**结构性**的那几条，
 * 因为它们是"看下去像不像一回事"的来源，而不是配色细节：
 *  1. 首屏在开始前就说清"这次谁上场"（团队行）；
 *  2. 侧栏七个分区可以收起：19rem 宽的栏不该被七个区块撑成一条长滚动；
 *  3. 分区标题带字形——与工具行同一套语义，扫一眼就知道哪块是什么；
 *  4. 收起时内容真的不渲染（display:none 而不是只藏视线）；
 *  5. 状态带不重复统计栏已有的数字。
 */

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const launch = read("src/features/scan-console/components/launch-screen.tsx");
const screen = read("src/features/scan-console/components/scan-screen.tsx");
const css = read("src/style.css");
const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
const en = JSON.parse(read("locales/en.json")) as Record<string, string>;

describe("the launch screen says who is on the team", () => {
	it("renders one chip per member, from the manifest's roster", () => {
		expect(launch).toContain("astra-strix-team-chips");
		expect(launch).toContain("team.members.map");
		// 名字来自服务读回的 roster，不是面板里写死的四个字符串。
		expect(launch).toContain("member.name");
	});

	it("marks the lead and shows the responsibility on hover", () => {
		expect(launch).toContain('data-lead={member.lead ? "yes" : "no"}');
		expect(launch).toContain("title={member.responsibility}");
	});

	it("picks the glyph by role, not by name", () => {
		// 换人、改名都不该改代码：字形跟着角色槽位走。
		expect(launch).toContain("TEAM_GLYPH[member.role");
		for (const role of ["master", "researcher", "developer", "auditor"]) {
			expect(launch).toContain(`${role}:`);
		}
	});

	it("has the label in both locales", () => {
		expect(zh["panel.team"]).toBeTruthy();
		expect(en["panel.team"]).toBeTruthy();
	});
});

describe("the rail can be folded down", () => {
	it("keeps a collapsed map with a sane default", () => {
		// 默认展开"这一眼要看的"，连接与历史收起。
		expect(screen).toMatch(/const \[collapsed, setCollapsed\] = useState<Record<string, boolean>>\(\{/);
		expect(screen).toMatch(/mcp: true,/);
		expect(screen).toMatch(/history: true,/);
		expect(screen).toMatch(/targets: false,/);
		expect(screen).toMatch(/findings: false,/);
	});

	it("makes the whole section title the toggle", () => {
		expect(screen).toContain("astra-strix-section-head");
		// aria-expanded 用的是布尔取反：collapsed ? "false" : "true"。
		expect(screen).toMatch(/aria-expanded=\{collapsed \? "false" : "true"\}/);
		// 旧的那颗 20px +/− 按钮属于 panel-box，不该被这次改动复用或改样式。
		expect(css).toContain(".astra-strix-section-head {");
		expect(css).not.toMatch(/\.astra-strix-section-head \{[^}]*width: 20px/s);
	});

	it("gives every section a glyph", () => {
		// 六个分区，每个一个字形（ADR 0019）。`▣` 原来是「会话」那一区，1.0.13 起它的两条事实
		// 并进了「统计」（ADR 0020：会话在哪跑不是独立主题，是这一轮的状态），分区随之取消。
		for (const glyph of ["◎", "◈", "▦", "⚉", "◷", "⇄"]) {
			expect(screen).toContain(glyph);
		}
		// 会话不再单独成区：确认它真的没了，而不是换了个地方又长回来。
		expect(screen).not.toContain('data-tone="session"');
	});

	it("actually hides the body when collapsed", () => {
		expect(css).toMatch(/\.astra-strix-section\[data-collapsed="yes"\] > \*:not\(\.astra-strix-section-title\) \{\s*display: none;/s);
	});
});

describe("the status band does not repeat the stats panel", () => {
	it("leaves model and step counts to the rail", () => {
		const band = /<header className="astra-strix-band">([\s\S]*?)<\/header>/.exec(screen)?.[1] ?? "";
		expect(band).not.toContain('t("scan.model")');
		expect(band).not.toContain('t("scan.steps")');
		// 目标数 / 深度 / 环境仍然在带里：它们是"现在在测什么"。
		expect(band).toContain('t("targets.title")');
		expect(band).toContain('t("scan.mode")');
	});
});
