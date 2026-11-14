/**
 * 面板与上游 TUI 的相似度：一份可复算的清单，而不是一句观感。
 *
 * 上游界面在 `strix/interface/tui/internal/app`（Go + lipgloss）与 `internal/render`
 * （每种工具一个渲染器）。这份脚本把「表面」拆成加权项，逐项在插件源码里找证据：
 * 找到了记满分，部分记半分，没有记 0。总分就是百分比。
 *
 * 运行：node tools/ui-parity.mjs
 * 只读：不写任何文件，不依赖上游运行。
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PLUGIN = "D:/open-source-projects/astravia-official-marketplace/abilities/plugins/strix";
const UPSTREAM_TUI = "D:/open-source-projects/strix/strix/interface/tui/internal";

/** 上游的工具渲染器清单（registry.go 里的键）。 */
function upstreamRenderers() {
	const file = join(UPSTREAM_TUI, "render/registry.go");
	const text = readFileSync(file, "utf8");
	const keys = new Set();
	for (const match of text.matchAll(/"([a-z_]+)":/g)) keys.add(match[1]);
	for (const skip of ["completed", "failed", "error", "running"]) keys.delete(skip);
	return [...keys].sort();
}

function pluginSource() {
	const files = [];
	const walk = (path) => {
		for (const entry of readdirSync(path, { withFileTypes: true })) {
			const full = join(path, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "test") continue;
				walk(full);
			} else if (/\.(ts|tsx|css)$/.test(entry.name)) {
				files.push(full);
			}
		}
	};
	walk(join(PLUGIN, "src"));
	return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const source = pluginSource();
const has = (needle) => source.includes(needle);
const css = readFileSync(join(PLUGIN, "src/style.css"), "utf8");

/** 加权清单：weight 是这一项在上游界面里的份量。 */
const items = [
	// 结构
	{ name: "启动屏 / splash", weight: 4, score: has("LaunchScreen") ? 1 : 0, note: "banner + 目标输入，对应 setup.go" },
	{ name: "实时转写（chat/trace 主体）", weight: 8, score: has("TraceBlock") ? 1 : 0, note: "render/chat.go" },
	{ name: "工具卡片", weight: 10, score: has("astra-strix-tool") ? 0.5 : 0, note: "有卡片，但只有一个通用渲染器" },
	{ name: "按工具分的渲染器", weight: 12, score: 0, note: "上游 ~27 个（report/todo/coverage/notes/proxy…）" },
	{ name: "状态行（模式/目标/步数/模型）", weight: 5, score: has("astra-strix-band") ? 1 : 0, note: "view.go sweepView + stats" },
	{ name: "侧栏 · 目标", weight: 3, score: has("targets.title") ? 1 : 0, note: "targetsBoxHeight" },
	{ name: "侧栏 · 统计", weight: 3, score: has("stats.title") ? 1 : 0, note: "statsView" },
	{ name: "侧栏 · 发现（漏洞）", weight: 5, score: has("findings.title") ? 1 : 0, note: "vulnerabilities.go" },
	{ name: "侧栏 · MCP 连接", weight: 3, score: has("mcp.title") ? 1 : 0, note: "mcp.go" },
	{ name: "侧栏 · 子智能体图", weight: 4, score: 0, note: "agents_graph.go；本插件无多智能体（ADR 0006）" },
	{ name: "计划 / 覆盖 / 笔记", weight: 6, score: has("ArtefactPanels") ? 1 : 0, note: "render/todo|coverage|notes.go" },
	{ name: "威胁模型", weight: 2, score: has("strix_threat_model") ? 1 : 0, note: "threat_model.go" },
	{ name: "输入框 + 快捷键提示", weight: 3, score: has("astra-strix-prompt-input") ? 1 : 0, note: "composer + ctrl-q/esc" },
	{ name: "会话/沙箱信息", weight: 2, score: has("session.title") ? 1 : 0, note: "session box" },
	// 排版与配色
	{ name: "语义配色（绿/红/琥珀/蓝）", weight: 4, score: has("--sx-green") ? 1 : 0, note: "styles.go 同名色板" },
	{ name: "等宽 + 尺寸层级", weight: 3, score: css.includes("--sx-mono") ? 1 : 0, note: "mono + 13/12.5/11.5 三档" },
	{ name: "左对齐的单一阅读列", weight: 3, score: /\.astra-strix-transcript-body[\s\S]{0,400}?margin: 0;/.test(css) ? 1 : 0, note: "0.7.3 修：此前 auto 居中" },
	{ name: "转写贴底跟随", weight: 3, score: has("useStickToBottom") ? 1 : 0, note: "上游 TUI 天然滚到底" },
	// 图像
	{ name: "转写里的图片渲染", weight: 3, score: 0, note: "上游用 kitty/iTerm 协议内联图；插件只把图给模型" },
	{ name: "markdown 渲染", weight: 3, score: 0, note: "上游渲染 markdown；插件把文字留给聊天区（ADR 0007）" },
];

const total = items.reduce((sum, item) => sum + item.weight, 0);
const earned = items.reduce((sum, item) => sum + item.weight * item.score, 0);
const pct = (earned / total) * 100;

const width = Math.max(...items.map((item) => item.name.length));
console.log("surface".padEnd(width), "w", "  score");
for (const item of items) {
	const label = item.name.padEnd(width);
	console.log(`${label} ${String(item.weight).padStart(2)}  ${item.score === 0 ? "  no" : item.score === 1 ? " full" : " part"}  ${item.note ?? ""}`);
}
console.log(`\nweighted: ${earned}/${total} = ${pct.toFixed(1)}%`);

const renderers = upstreamRenderers();
console.log(`\nupstream tool renderers: ${renderers.length}`);
console.log(renderers.join(", "));

// 结构性对照：上游有、插件没有的渲染器具体是哪些
const pluginToolNames = [...source.matchAll(/name: "(strix_[a-z_]+)"/g)].map((match) => match[1]);
console.log(`plugin tools: ${pluginToolNames.length}`);

// 只统计存在性，不评价实现质量；文件本身就是口径
console.log(`\nplugin sources: ${existsSync(join(PLUGIN, "src")) ? "ok" : "missing"}`);
console.log(`upstream tui: ${statSync(UPSTREAM_TUI).isDirectory() ? "ok" : "missing"}`);
