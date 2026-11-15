/**
 * 插件 vs 上游：两个问题、一份实现。
 *
 *   node scripts/dev/parity.mjs              # 两段都跑
 *   node scripts/dev/parity.mjs --capability # 只有能力对照（A 原始 / B 在范围内）
 *   node scripts/dev/parity.mjs --ui         # 只有界面表面相似度
 *
 * 为什么合并：两个旧脚本各自重写了一遍"读插件源码"的 walker，而且回答的是同一个问题
 * 的两个面（"能力有没有"与"界面像不像"）。合成一个之后只有一份 IO、一个入口、
 * 一处时间戳口径。旧脚本里还写着"三组数字"却只算了 A 与 B —— 那种许诺过却不产出的
 * 数字比没有更糟，所以第三项直接删掉，不假装有。
 *
 * 只读：不写文件，不依赖任何一侧运行。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PLUGIN = "D:/open-source-projects/astravia-official-marketplace/abilities/plugins/strix";
const UPSTREAM = "D:/open-source-projects/strix/strix";

// ---- 共用 IO ----------------------------------------------------------------

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

/** 插件生产代码的全文（不含测试）：所有"有没有"的判断都只从这一份文本出发。 */
const source = (() => {
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
const css = read(join(PLUGIN, "src/style.css"));
const has = (needle) => source.includes(needle);

const pluginTools = [...read(join(PLUGIN, "src/agent/strix-tools.ts")).matchAll(/name: "(strix_[a-z_]+)"/g)].map(
	(match) => match[1],
);
const hasTool = (name) => pluginTools.includes(name);

/** 上游工具渲染器的注册键（registry.go）。 */
function upstreamRenderers() {
	const keys = new Set();
	for (const match of read(join(UPSTREAM, "interface/tui/internal/render/registry.go")).matchAll(/"([a-z_]+)":/g)) {
		keys.add(match[1]);
	}
	for (const skip of ["completed", "failed", "error", "running"]) keys.delete(skip);
	return [...keys].sort();
}

// ---- 能力对照 ----------------------------------------------------------------

/** 本宿主里不该由插件承担的能力（ADR 0003 / 0006）：不算进"在范围内"。 */
const DELEGATED = new Set(["模型路由（本宿主由宿主承担）", "多智能体编排（有意不做）", "云端与账号"]);

const families = [
	{
		name: "执行环境（沙箱）",
		items: [
			[3, "容器内执行", "containers/ + runtime/", hasTool("strix_exec")],
			[2, "镜像自带工具链", "containers/Dockerfile", has("sandboxImage") || has("DEFAULT_IMAGE")],
			[2, "本机降级执行（无 Docker）", "core/execution.py", has("beginHost") || has('"host"')],
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
			[
				2,
				"随包工具手册（无 CLI 时）",
				"skills/tooling (13)",
				countFiles(join(PLUGIN, "agent/skills/library/tooling"), (n) => n.endsWith(".md")) >= 13,
			],
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
			// 上游自己压缩上下文；本插件的循环在宿主，所以落点是「让压缩可见」。
			[1, "上下文压缩（宿主的压缩在面板可见）", "llm/compaction.py", has("scan.compacted") && has('role === "compaction"')],
			// 上游算钱；我们没有模型调用，"成本"= 这一轮能做多少事。
			[1, "预算/成本控制（额度拦截）", "interface/cloud/billing + budget", hasTool("strix_budget") && existsSync(join(PLUGIN, "src/service/budget.ts"))],
			// 上游外发匿名数据；本插件不联网，做同一件事的另一半：本机统计。
			[1, "遥测（本机统计，不外发）", "telemetry/", existsSync(join(PLUGIN, "src/service/telemetry.ts")) && has("telemetry.json")],
			// 不联网 ⇒ 不问"上游有没有新版"，改问三件能读的事实。
			[1, "更新检查（组件新鲜度）", "interface/update_check.py", hasTool("strix_update_check") && existsSync(join(PLUGIN, "src/service/freshness.ts"))],
		],
	},
	{
		name: "界面",
		items: [
			[3, "实时轨迹 + 工具卡片", "interface/tui", has("TraceBlock")],
			[2, "状态行（模式/目标/步数/模型）", "interface/tui/internal/app/view.go", has("astra-strix-band")],
			[3, "侧栏（目标/统计/发现/MCP/会话）", "interface/tui/internal/app/view.go", has("ArtefactPanels")],
			[2, "启动屏 + 目标输入", "interface/scan_setup.py", has("LaunchScreen")],
			[3, "按工具区分的渲染器（24 种）", "interface/tui/internal/render", /\| "(sandbox|environment|budget|history|freshness|team)"/.test(read(join(PLUGIN, "src/features/scan-console/tool-presentation.ts")))],
			[2, "网页 viewer（历史 run 浏览）", "interface/viewer", hasTool("strix_history") && has("panel.history")],
			[2, "子智能体图（团队花名册）", "interface/tui/internal/render/agents_graph.go", hasTool("strix_team_roster") && has("panel.team")],
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
			[3, "派生/等待/停止子智能体", "tools/agents_graph", false, "需要插件侧模型循环；团队成员改为声明（ADR 0016）"],
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

function runCapability() {
	const rows = [];
	let rawEarned = 0;
	let rawTotal = 0;
	let scopedEarned = 0;
	let scopedTotal = 0;

	for (const family of families) {
		let familyEarned = 0;
		let familyTotal = 0;
		for (const [weight, label, upstream, present, note] of family.items) {
			familyTotal += weight;
			if (present) familyEarned += weight;
			rows.push({ family: family.name, weight, label, upstream, present, note });
		}
		rawEarned += familyEarned;
		rawTotal += familyTotal;
		if (!DELEGATED.has(family.name)) {
			scopedEarned += familyEarned;
			scopedTotal += familyTotal;
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
	console.log("\n—— 能力 ——");
	console.log(`A. 原始能力覆盖率      ${rawEarned}/${rawTotal} = ${pct(rawEarned, rawTotal)}%`);
	console.log(`B. 在范围内覆盖率      ${scopedEarned}/${scopedTotal} = ${pct(scopedEarned, scopedTotal)}%   （剔除模型路由/多智能体/云端）`);
	console.log(`   插件工具数 ${pluginTools.length} · 插件测试文件 ${countFiles(join(PLUGIN, "test"))}`);
	console.log(
		`   上游技能 md ${countFiles(join(UPSTREAM, "skills"), (n) => n.endsWith(".md"))} · 上游工具渲染器 ${upstreamRenderers().length}`,
	);
}

// ---- 界面表面 ----------------------------------------------------------------

function runUi() {
	const items = [
		{ name: "启动屏 / splash", weight: 4, score: has("LaunchScreen") ? 1 : 0, note: "banner + 目标输入，对应 setup.go" },
		{ name: "实时转写（chat/trace 主体）", weight: 8, score: has("TraceBlock") ? 1 : 0, note: "render/chat.go" },
		{
			name: "工具卡片",
			weight: 10,
			score: has("astra-strix-tool-glyph-mark") ? 1 : has("astra-strix-tool") ? 0.5 : 0,
			note: "字形 + 家族色调 + 可展开",
		},
		{
			name: "按工具分的渲染器",
			weight: 12,
			// 上游 24 个一对一渲染器；本插件 21 个家族覆盖 40 个工具。家族化能表达
			// "这是补丁 / 这是覆盖 / 这是发现"，但同家族内的差异会被抹平，故记 3/4。
			score: has("presentTool(") && has("data-family") ? 0.75 : 0,
			note: "21 家族 + generic（上游 24 个一对一）",
		},
		{ name: "状态行（模式/目标/步数/模型）", weight: 5, score: has("astra-strix-band") ? 1 : 0, note: "view.go sweepView + stats" },
		{ name: "侧栏 · 目标", weight: 3, score: has("targets.title") ? 1 : 0, note: "targetsBoxHeight" },
		{ name: "侧栏 · 统计", weight: 3, score: has("stats.title") ? 1 : 0, note: "statsView" },
		{ name: "侧栏 · 发现（漏洞）", weight: 5, score: has("findings.title") ? 1 : 0, note: "vulnerabilities.go" },
		{ name: "侧栏 · MCP 连接", weight: 3, score: has("mcp.title") ? 1 : 0, note: "mcp.go" },
		{
			name: "侧栏 · 子智能体图",
			weight: 4,
			// 上游画的是它自己派生出来的父子树；本插件画团队花名册 + 署名数。
			// 成员身份与产出都是真的，但没有"谁正在跑"这层——所以记一半。
			score: has("panel.team") && has("strix_team_roster") ? 0.5 : 0,
			note: "agents_graph.go；本插件改为团队花名册（ADR 0016）",
		},
		{ name: "计划 / 覆盖 / 笔记", weight: 6, score: has("ArtefactPanels") ? 1 : 0, note: "render/todo|coverage|notes.go" },
		{ name: "威胁模型", weight: 2, score: has("strix_threat_model") ? 1 : 0, note: "threat_model.go" },
		{ name: "输入框 + 快捷键提示", weight: 3, score: has("astra-strix-prompt-input") ? 1 : 0, note: "composer + ctrl-q/esc" },
		{ name: "会话/沙箱信息", weight: 2, score: has("session.title") ? 1 : 0, note: "session box" },
		{ name: "语义配色（绿/红/琥珀/蓝）", weight: 4, score: has("--sx-green") ? 1 : 0, note: "styles.go 同名色板" },
		{ name: "等宽 + 尺寸层级", weight: 3, score: css.includes("--sx-mono") ? 1 : 0, note: "mono + 13/12.5/11.5 三档" },
		{
			name: "左对齐的单一阅读列",
			weight: 3,
			score: /\.astra-strix-transcript-body[\s\S]{0,400}?margin: 0;/.test(css) ? 1 : 0,
			note: "0.7.3 修：此前 auto 居中",
		},
		{ name: "转写贴底跟随", weight: 3, score: has("useStickToBottom") ? 1 : 0, note: "上游 TUI 天然滚到底" },
		{ name: "转写里的图片渲染", weight: 3, score: 0, note: "上游用 kitty/iTerm 协议内联图；插件只把图给模型" },
		{ name: "markdown 渲染", weight: 3, score: 0, note: "上游渲染 markdown；插件把文字留给聊天区（ADR 0007）" },
	];

	const total = items.reduce((sum, item) => sum + item.weight, 0);
	const earned = items.reduce((sum, item) => sum + item.weight * item.score, 0);
	const width = Math.max(...items.map((item) => item.name.length));
	console.log("surface".padEnd(width), "w", "  score");
	for (const item of items) {
		const score = item.score === 0 ? "  no" : item.score === 1 ? " full" : " part";
		console.log(`${item.name.padEnd(width)} ${String(item.weight).padStart(2)}  ${score}  ${item.note ?? ""}`);
	}
	console.log(`\n—— 界面 ——`);
	console.log(`weighted: ${earned}/${total} = ${((earned / total) * 100).toFixed(1)}%`);
	console.log(`upstream tool renderers: ${upstreamRenderers().length} · plugin tools: ${pluginTools.length}`);
}

// ---- 入口 --------------------------------------------------------------------

const argv = new Set(process.argv.slice(2));
const both = !argv.has("--ui") && !argv.has("--capability");
if (both || argv.has("--capability")) runCapability();
if (both || argv.has("--ui")) runUi();

// 路径自检：两侧读不到就直说，而不是打印 0% 让人以为"什么都没做"。
if (!existsSync(join(PLUGIN, "src"))) console.log("\nplugin sources: missing");
if (!existsSync(UPSTREAM) || !statSync(UPSTREAM).isDirectory()) console.log("upstream checkout: missing");
