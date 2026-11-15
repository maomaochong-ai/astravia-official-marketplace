import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const css = read("src/style.css");
const launch = read("src/features/scan-console/components/launch-screen.tsx");
const scan = read("src/features/scan-console/components/scan-screen.tsx");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");
const index = read("src/index.tsx");
const manifest = JSON.parse(read("plugin.json")) as { permissions: string[] };
const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
const en = JSON.parse(read("locales/en.json")) as Record<string, string>;

/**
 * 首屏呈现：整块宽度、头部居中、事实表两列、环境行、脚注。
 *
 * 读的是源码与 CSS 文本，守"结构意图"；渲染行为由 screens / composer 的挂载测试覆盖。
 */

describe("the first screen is one column again", () => {
	it("gives every row under the composer the same left edge", () => {
		expect(css).toContain("一条左边缘（1.0.3）");
		const block = /\.astra-strix-meta,\s*\.astra-strix-env,\s*\.astra-strix-hints,\s*\.astra-strix-boot,[\s\S]*?\{([^}]*)\}/.exec(css)?.[1] ?? "";
		expect(block).toContain("padding-left: 2px");
	});

	it("shows the model once, not twice", () => {
		// 输入框内不再渲染模型，唯一的一行在框下面。
		const occurrences = launch.match(/astra-strix-meta-name/g) ?? [];
		expect(occurrences.length).toBe(1);
	});

	it("hides the drag handle until it is useful", () => {
		// 真机截图里它像一条悬空的绿线。
		expect(css).toMatch(/\.astra-strix-resize-handle::before\s*\{[^}]*opacity:\s*0/s);
		expect(css).toMatch(/\.astra-strix-prompt:hover \.astra-strix-resize-handle::before/s);
	});
});

describe("the hierarchy lines up", () => {
	it("gives every row the same two columns", () => {
		// 1.0.4 起标签列 / 值列是一个栅格：5.2em 在**行容器**上解析（只有一个字号上下文），
		// 所以不会出现 1.0.3 那种“各标签字号不同 → 值起点错开 7px”。
		const row = /\.astra-strix-row \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(row).toContain("display: grid");
		expect(row).toMatch(/grid-template-columns:\s*5\.2em\s+minmax\(0,\s*1fr\)/);
	});

	it("keeps the buttons in one row and the same height as the select", () => {
		// 之前按钮各自换行、与下拉高矮不一，正是“层次不齐”。
		const action = /\.astra-strix-env-action \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		const select = /\.astra-strix-env-select \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(action).toContain("height: 22px");
		expect(select).toContain("height: 22px");
		expect(launch).toContain("astra-strix-env-actions");
	});

	it("puts the status beside the control, inside the value column", () => {
		// 1.0.3 是“状态另起一行、从下拉左边缘开始”；1.0.4 起同一行右接，仍在值列内。
		expect(launch).toContain("astra-strix-env-line");
		const line = /\.astra-strix-env-line \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(line).toContain("display: flex");
		expect(line).toContain("flex-wrap: wrap");
	});
});

describe("the environment selector is readable", () => {
	it("gives the control its own background and light text", () => {
		const block = /\.astra-strix-env-select\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(block).toContain("background-color:");
		expect(block).toContain("color: var(--sx-white");
	});

	it("styles the native dropdown list too", () => {
		// 展开后的 option 是系统渲染的：单独设，否则白底深字。
		expect(css).toMatch(/\.astra-strix-env-select option\s*\{[^}]*background-color:\s*#04120a/s);
	});
});

describe("the environment reports what it found", () => {
	it("has three states, not a boolean", () => {
		expect(launch).toContain('"host" | "noDocker" | "noImage" | "ready"');
		expect(launch).toContain('data-state={envState}');
	});

	it("offers install when docker is missing and a pull when the image is not local", () => {
		expect(launch).toContain('t("env.install")');
		expect(launch).toContain('t("env.pull")');
		expect(launch).toContain("onPullImage");
	});

	it("probes again as soon as the operator switches environment", () => {
		const block = /const setEnvironmentMode[\s\S]{0,700}?\[client\],/.exec(hook)?.[0] ?? "";
		expect(block).toContain("probeEnvironment");
	});
});

describe("the rows under the composer line up", () => {
	it("renders one facts block with label/value pairs", () => {
		expect(launch).toContain("astra-strix-rows");
		const rows = launch.match(/className="astra-strix-row"/g) ?? [];
		// 模型 / 环境 / 日志 / 快捷键 / 桥接状态
		expect(rows.length).toBeGreaterThanOrEqual(4);
		expect(launch).toContain("astra-strix-row-label");
	});

	it("uses a two-column grid, not per-row padding", () => {
		const block = /\.astra-strix-row\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(block).toContain("display: grid");
		expect(block).toMatch(/grid-template-columns:\s*[\d.]+em\s+minmax\(0,\s*1fr\)/);
	});

	it("keeps the environment controls inside the value column", () => {
		expect(launch).toContain("astra-strix-env-line");
		expect(launch).toContain("astra-strix-env-actions");
		// 1.0.8：动作与下拉在同一条 flex 行上（不再 margin-top 另起一行，
		// 那正是用户截图里"刷新环境"单独掉下去的样子）。
		const actions = /\.astra-strix-env-actions\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(actions).toContain("inline-flex");
		expect(actions).not.toMatch(/margin-top/);
	});

	it("gives the select and buttons one height, so the line reads as one row", () => {
		expect(css).toMatch(/\.astra-strix-env-select\s*\{[^}]*height:\s*22px/s);
		expect(css).toMatch(/\.astra-strix-env-action\s*\{[^}]*height:\s*22px/s);
	});
});

describe("the launch column is centred, not stretched", () => {
	it("caps the whole block in pixels instead of ch", () => {
		// ch 跟着字体走：CJK 等宽下 1ch ≈ 13px，72ch 就快一屏了。
		// 宽度的 px 上限在基规则上（1.0.6 把两条合成一条）：不再有单独覆盖块。
		const rule = /\.astra-strix-launch \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
		expect(rule).toMatch(/width:\s*min\(\s*\d+px\s*,\s*100%\s*\)/);
		expect(rule).toMatch(/margin:\s*auto/);
	});

	it("centres the head and keeps the rows left-aligned", () => {
		// 头部规则在文件里出现过两次（1.0.3 只对齐子项，1.0.5 补上文字居中）：
		// 只要有一份同时具备两者，就是终态意图。
		const heads = [...css.matchAll(/\.astra-strix-launch-head\s*\{([^}]*)\}/g)].map((match) => match[1] ?? "");
		expect(heads.some((head) => head.includes("align-items: center") && head.includes("text-align: center"))).toBe(true);
		// 行不能跟着居中：标签列 + 值列靠左才读得成表。
		const rows = /\.astra-strix-rows\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
		expect(rows).not.toContain("text-align: center");
	});
});

describe("no parentheses, no decorative bullets", () => {
	it("names the environments without brackets", () => {
		for (const value of [zh["env.docker"], zh["env.host"], zh["env.auto"], en["env.docker"], en["env.host"], en["env.auto"]]) {
			expect(value).toBeTruthy();
			expect(value).not.toMatch(/[（）()]/);
		}
	});

	it("keeps the status lines free of brackets too", () => {
		for (const key of ["env.statusHost", "env.statusNoDocker", "env.statusNoImage", "env.statusReady"]) {
			expect(zh[key]).not.toMatch(/[（）()]/);
			expect(en[key]).not.toMatch(/[()]/);
		}
	});

	it("does not put a dot in front of the model name", () => {
		const modelRow = /data-missing=\{[^}]*\}([\s\S]*?)<\/div>/.exec(launch)?.[1] ?? "";
		expect(modelRow).toContain("astra-strix-meta-name");
		expect(modelRow).not.toMatch(/[●○]/);
		// 状态行仍然有状态点：它是状态，不是装饰。
		expect(launch).toMatch(/astra-strix-green[^>]*>\s*●/);
	});
});

describe("essential text drops to a footnote", () => {
	it("renders hints, boot state and version as one footer line", () => {
		expect(launch).toContain("astra-strix-launch-foot");
		const foot = /\.astra-strix-launch-foot \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(foot).toContain("border-top");
		// 版本 / 快捷藏在脚注；事实表里只留模型、目录、环境。
		expect(launch.indexOf("astra-strix-launch-foot")).toBeGreaterThan(launch.indexOf("astra-strix-rows"));
	});

	it("says the folder once, as a fact", () => {
		expect(launch).toContain('t("launch.folder")');
		// 日志里那条“已挂载工作目录”没了：同一句话说两遍是噪声。
		expect(hook).not.toContain('t("log.workspaceMounted")');
		expect(hook).not.toContain('t("log.modelFromConversation")');
	});
});

describe("the footer keeps the version on one line", () => {
	it("wraps boot state and version in one non-wrapping group", () => {
		const group = /\.astra-strix-boot-line \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(group).toContain("inline-flex");
		expect(group).toContain("white-space: nowrap");
		expect(group).toContain("margin-left: auto");
	});

	it("does not push the version out of that group", () => {
		const version = /\.astra-strix-hints-version \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(version).not.toMatch(/margin-left:\s*auto/);
		// 版本必须渲染在 boot-line 里面：外面就没有"整组不换行"这回事了。
		expect(launch).toMatch(/astra-strix-boot-line[\s\S]*?astra-strix-hints-version/);
	});
});

describe("the environment row is one row", () => {
	it("puts the actions in the same flex line as the select", () => {
		// 顺序：env-line 开 → select → status → actions → 关；中间不出现闭合。
		const row = /astra-strix-env-line[\s\S]*?astra-strix-env-actions[\s\S]*?<\/span>\s*<\/span>\s*<\/div>/.exec(launch);
		expect(row).toBeTruthy();
		const actions = /\.astra-strix-env-actions \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(actions).toContain("inline-flex");
		expect(actions).not.toMatch(/margin-top/);
	});

	it("lets the line wrap only when the panel is actually narrow", () => {
		const line = /\.astra-strix-env-line \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(line).toContain("flex-wrap: wrap");
	});
});
