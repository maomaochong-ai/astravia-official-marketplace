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
const rain = readFileSync(resolve(plugin, "src/features/scan-console/components/hacker-rain.tsx"), "utf8");

describe("data rain on the first screen", () => {
	it("renders decorative columns with a fixed glyph set", () => {
		expect(rain).toContain("astra-strix-rain");
		expect(rain).toContain("aria-hidden=\"true\"");
		// 固定字符集：随机会让截图与测试不可复现。
		expect(rain).toContain("GLYPHS");
		// 注释里写着"不用 Math.random"，所以先剥注释再断言。
		expect(rain.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/Math\.random/);
		// 首屏用它
		expect(launch).toContain("HackerRain");
	});

	it("is dense enough to read as code rain, not as scattered glyphs", () => {
		// 用户反馈「不够密集」。列数与每列字数都在组件里，这里钉住下限。
		const columns = /splash: (\d+)/.exec(rain)?.[1];
		const workbench = /workbench: (\d+)/.exec(rain)?.[1];
		const rows = /const ROWS = (\d+)/.exec(rain)?.[1];
		expect(Number(columns)).toBeGreaterThanOrEqual(40);
		expect(Number(workbench)).toBeGreaterThan(Number(columns));
		expect(Number(rows)).toBeGreaterThanOrEqual(30);
		// 两档不透明度：工作台必须比首屏淡（它后面是要读的文本）
		expect(css).toMatch(/\.astra-strix-rain\[data-density="workbench"\][^}]*opacity:\s*0\.0\d/s);
	});

	it("also sits behind the workbench", () => {
		expect(scan).toContain("HackerRain");
		expect(scan).toContain('density="workbench"');
		// 内容层必须压在雨之上
		expect(css).toMatch(/\.astra-strix-workbench > \*:not\(\.astra-strix-rain\)[^}]*z-index:\s*1/s);
		// 雨是绝对定位的，需要一个定位祖先并裁掉溢出
		expect(css).toMatch(/\.astra-strix-term \{[\s\S]{0,900}?position: relative;[\s\S]{0,200}?overflow: hidden;/);
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
