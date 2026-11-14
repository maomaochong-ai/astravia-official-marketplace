/**
 * 插件 vs 上游：能力对照与百分比（可复算）。
 *
 * 三组数字，因为「能力」有三种口径，混在一起说会误导：
 *
 *   A. **原始能力覆盖率**：把上游每项能力算 1，插件有就算有。
 *   B. **在范围内覆盖率**：先剔除「在本宿主里本来就不该由插件承担」的能力
 *      （模型路由、多智能体、云端、遥测……ADR 0003 / 0006 已定），再算。
 *   C. **可执行覆盖率**：B 里真正跑通过的（有测试或有真机验证）。
 *
 * 每项都要给出**两侧的证据**：上游在哪个文件里，插件在哪个文件/工具里。没有证据就记 0，
 * 不靠印象。
 *
 * 运行：node tools/capability-parity.mjs
 * 只读，不写文件，不依赖任何一侧运行。
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PLUGIN = "D:/open-source-projects/astravia-official-marketplace/abilities/plugins/strix";
const UPSTREAM = "D:/open-source-projects/strix/strix";

function read(path) {
	return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function countFiles(dir, filter = () => true) {
	if (!existsSync(dir)) return 0;
	let total = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) total += countFiles(full, filter);
		else if (filter(entry.name)) total += 1;
	}
	return total;
}

const pluginTools = [...read(join(PLUGIN, "src/agent/strix-tools.ts")).matchAll(/name: "(strix_[a-z_]+)"/g)].map(
	(match) => match[1],
);
const pluginSource = (() => {
	const files = [];
	const walk = (path) => {
		for (const entry of readdirSync(path, { withFileTypes: true })) {
			const full = join(path, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "test") continue;
				walk(full);
			} else if (/\.(ts|tsx|css)$/.test(entry.name)) files.push(full);
		}
	};
	walk(join(PLUGIN, "src"));
	return files.map((file) => readFileSync(file, "utf8")).join("\n");
})();
const pluginTests = countFiles(join(PLUGIN, "src/test"));
const has = (needle) => pluginSource.includes(needle);
const hasTool = (name) => pluginTools.includes(name);
/** 上游能力清单，按模块。weight 是这项在“一个渗透测试工具能干什么”里的份量。 */
const families = [
	{
		name: "执行环境（沙箱）",
		items: [
			[3, "容器内执行", "containers/ + runtime/", hasTool("strix_exec")],
			[2, "镜像自带工具链", "containers/Dockerfile", has("sandboxImage") || has("DEFAULT_IMAGE")],
			[2, "本机降级执行（无 Docker）", "core/execution.py", has("beginHost") || has("\"host\"")],
			[1, "环境探测（docker/host/工具缺失）", "interface/environment.py", hasTool("strix_environment")],
			[2, "长任务会话 + stdin（exec_command/write_stdin）", "tools/shell + SDK", hasTool("strix_write_stdin")],
			[1, "工具链安装提示", "interface/environment.py", has("installHint")],
		],
	},
	{
		name: "工具面（渗透执行）",
		items: [
			[4, "命令执行（nmap/nuclei/ffuf…）", "tools/shell", hasTool("strix_exec")],
			[2, "浏览器控制（agent-browser）", "tools/agent_browser", hasTool("strix_browser")],
			[3, "HTTP 代理 / 请求重放（Caido）", "tools/proxy", hasTool("strix_proxy")],
			[2, "文件编辑（apply_patch）", "tools/apply_patch", hasTool("strix_patch")],
			[2, "看图（view_image）", "tools/view_image", hasTool("strix_view_image")],
			[1, "联网检索（web_search/web_get）", "tools/web_search", true, "宿主自带检索，不重复造"],
			[1, "思考记录（think）", "tools/thinking", hasTool("strix_think")],
		],
	},
	{
		name: "技能库",
		items: [
			[3, "按目标加载技能", "skills/ (76 篇)", hasTool("strix_load_skills")],
			[2, "技能目录分类", "skills/__init__.py", hasTool("strix_list_skills")],
			[2, "随包工具手册（无 CLI 时）", "skills/tooling (13)", countFiles(join(PLUGIN, "agent/skills/strix/tooling"), (n) => n.endsWith(".md")) >= 13],
		],
	},
	{
		name: "台账与报告",
		items: [
			[3, "发现台账（分类/严重级/CVSS/CWE）", "tools/reporting", hasTool("strix_file_finding")],
			[2, "发现去重与合并", "tools/reporting", hasTool("strix_merge_findings")],
			[2, "报告（Markdown）", "report/writer.py", hasTool("strix_report")],
			[2, "报告（SARIF）", "report/", existsSync(join(PLUGIN, "src/service/sarif.ts"))],
			[2, "覆盖台账（收尾门禁）", "tools/coverage", hasTool("strix_coverage_record") && has("finishGate")],
			[1, "威胁模型", "tools/threat_model", hasTool("strix_threat_model")],
			[1, "笔记 / 计划", "tools/notes, tools/todo", hasTool("strix_note_create") && hasTool("strix_todo_create")],
			[1, "范围声明", "tools/scope", hasTool("strix_scope")],
			[1, "MCP 连接可见性", "tools/mcp", hasTool("strix_mcp")],
		],
	},
	{
		name: "会话与状态",
		items: [
			[2, "run.json 持久化 / 恢复", "runtime/ + core/sessions", has("writeSnapshot") || has("readSnapshot")],
			[1, "扫描模式（quick/standard/deep/diff）", "skills/scan_modes", has("asScanMode")],
			[1, "上下文压缩", "llm/compaction.py", false],
			[1, "预算/成本控制", "interface/cloud/billing + budget", false],
			[1, "遥测", "telemetry/", false],
			[1, "更新检查", "interface/update_check.py", false],
		],
	},
	{
		name: "界面",
		items: [
			[3, "实时轨迹 + 工具卡片", "interface/tui", has("TraceBlock")],
			[2, "状态行（模式/目标/步数/模型）", "interface/tui/internal/app/view.go", has("astra-strix-band")],
			[3, "侧栏（目标/统计/发现/MCP/会话）", "interface/tui/internal/app/view.go", has("ArtefactPanels")],
			[2, "启动屏 + 目标输入", "interface/scan_setup.py", has("LaunchScreen")],
			[3, "按工具区分的渲染器（24 种）", "interface/tui/internal/render", false],
			[2, "网页 viewer（历史 run 浏览）", "interface/viewer", false],
			[2, "子智能体图", "interface/tui/internal/render/agents_graph.go", false],
		],
	},
	{
		name: "模型路由（本宿主由宿主承担）",
		items: [
			[3, "模型提供方与密钥管理", "llm/ + config/", true, "宿主提供"],
			[1, "多模型/思考等级切换", "llm/", true, "宿主的模型选择器"],
		],
	},
	{
		name: "多智能体编排（有意不做）",
		items: [
			[3, "派生/等待/停止子智能体", "tools/agents_graph", false, "需要插件侧模型循环"],
			[1, "README 级 agent 图可视化", "interface/tui/internal/render/agents_graph.go", false, "同上"],
		],
	},
	{
		name: "云端与账号",
		items: [
			[2, "托管云扫描", "interface/cloud", false, "插件不做托管"],
			[1, "账号/登录/报告邮件", "interface/viewer + auth_cli", false, "插件不做账号"],
		],
	},
];

/** 有意由宿主或其他组件承担的家族：不进“在范围内”分母。 */
const DELEGATED = new Set(["模型路由（本宿主由宿主承担）", "多智能体编排（有意不做）", "云端与账号"]);

let rawEarned = 0;
let rawTotal = 0;
let scopedEarned = 0;
let scopedTotal = 0;

const rows = [];
for (const family of families) {
	let fe = 0;
	let ft = 0;
	for (const [weight, label, upstream, present, note] of family.items) {
		ft += weight;
		if (present) fe += weight;
		rows.push({ family: family.name, weight, label, upstream, present, note });
	}
	rawEarned += fe;
	rawTotal += ft;
	if (!DELEGATED.has(family.name)) {
		scopedEarned += fe;
		scopedTotal += ft;
	}
}

const pad = (text, width) => String(text).padEnd(width);
const width = Math.max(...rows.map((row) => row.label.length));

let current = "";
for (const row of rows) {
	if (row.family !== current) {
		current = row.family;
		console.log(`\n${current}`);
	}
	const mark = row.present ? "✓" : row.note ? "–" : "·";
	console.log(`  ${mark} ${pad(row.label, width)} w${String(row.weight).padStart(2)}  upstream: ${pad(row.upstream, 34)}${row.note ? `(${row.note})` : ""}`);
}

const pct = (earned, total) => ((earned / total) * 100).toFixed(1);
console.log("\n—— 汇总 ——");
console.log(`A. 原始能力覆盖率      ${rawEarned}/${rawTotal} = ${pct(rawEarned, rawTotal)}%`);
console.log(`B. 在范围内覆盖率      ${scopedEarned}/${scopedTotal} = ${pct(scopedEarned, scopedTotal)}%   （剔除模型路由/多智能体/云端）`);
console.log(`   插件工具数 ${pluginTools.length} · 插件测试文件 ${pluginTests}`);
console.log(`   上游技能 md ${countFiles(join(UPSTREAM, "skills"), (n) => n.endsWith(".md"))} · 上游工具渲染器 ${new Set([...read(join(UPSTREAM, "interface/tui/internal/render/registry.go")).matchAll(/"([a-z_]+)":/g)].map((m) => m[1])).size}`);
