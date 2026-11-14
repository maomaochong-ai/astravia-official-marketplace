import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 用户这一轮选的四个决定（ADR 0011），每条都要有代码落点，不能只是“我记得改过”。
 *
 *  1. 首屏 = 数据流背景（低对比、纯 CSS、可关动效）
 *  2. 强度 = 全绿磷光（单色绿 + 扫描线；红/琥珀只留给失败/进行中）
 *  3. 工作单元 = 只列沙箱会话，不显示宿主子智能体
 *  4. 扫光 = 状态带 + 轨迹行首（行首 4 格，比状态带小一档）
 */

const plugin = resolve(process.cwd());
const css = readFileSync(resolve(plugin, "src/style.css"), "utf8");
const launch = readFileSync(resolve(plugin, "src/features/scan-console/components/launch-screen.tsx"), "utf8");
const scan = readFileSync(resolve(plugin, "src/features/scan-console/components/scan-screen.tsx"), "utf8");
const trace = readFileSync(resolve(plugin, "src/features/scan-console/components/trace-block.tsx"), "utf8");
const panels = readFileSync(resolve(plugin, "src/features/scan-console/components/artefact-panels.tsx"), "utf8");

describe("data rain on the first screen", () => {
	it("renders decorative columns with a fixed glyph set", () => {
		expect(launch).toContain("astra-strix-rain");
		expect(launch).toContain("aria-hidden=\"true\"");
		// 固定字符集：随机会让截图与测试不可复现。
		expect(launch).toContain("RAIN_GLYPHS");
		expect(launch).toContain("RAIN_COLUMNS");
		expect(launch).not.toMatch(/Math\.random\(\)/);
	});

	it("stops moving when the reader asks for reduced motion", () => {
		expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.astra-strix-rain > span\s*\{\s*animation: none/);
	});
});

describe("phosphor", () => {
	it("is a variable override, not a hard-coded black", () => {
		expect(css).toContain(".astra-strix-term.astra-strix-phosphor");
		// 背景仍是 color-mix 与宿主底色混合，亮色主题下不该被钉死成纯黑。
		expect(css).toMatch(/\.astra-strix-phosphor\s*\{[^}]*background:\s*color-mix\(/s);
	});

	it("keeps red and amber only for failure and in-progress", () => {
		const block = /\.astra-strix-term\.astra-strix-phosphor\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(block).toContain("--sx-red:");
		expect(block).toContain("--sx-amber:");
		// 主色必须是绿系
		expect(block).toMatch(/--sx-green:\s*#22c55e/);
	});

	it("applies to both screens", () => {
		expect(launch).toContain("astra-strix-phosphor");
		expect(scan).toContain("astra-strix-phosphor");
	});
});

describe("sweep", () => {
	it("sits in the status band with six squares", () => {
		expect(scan).toContain("astra-strix-sweep");
		expect(scan).toMatch(/length: 6/);
	});

	it("repeats at the head of a running tool row, smaller", () => {
		expect(trace).toContain('data-size="row"');
		expect(trace).toMatch(/length: 4/);
		expect(css).toMatch(/\.astra-strix-sweep\[data-size="row"\] > span\s*\{[^}]*width: 3px/s);
	});

	it("is static when the panel is idle", () => {
		expect(css).toMatch(/\.astra-strix-sweep\[data-active="no"\] > span\s*\{[^}]*animation: none/s);
	});
});

describe("working units stay honest", () => {
	it("lists shell sessions only, never host subagents", () => {
		expect(panels).toContain("ShellSessionSummary");
		expect(panels).toContain("sessions.title");
		// 宿主子智能体在宿主自己的面板里；这里不该出现派生/派发字样。
		expect(panels).not.toMatch(/spawn|dispatch_subagent|subagent/i);
	});
});
