/**
 * 注入目标矩阵：这台机器上「寒霜」这套东西能被装进哪些宿主。
 *
 * 数据来自上游桌面注入器的实测表（9 个目标），但**形态被重新分类**：
 * 上游按「装哪个客户端」分，这里按「怎么装进去」分，因为插件只能给出计划与脚本，
 * 真正决定能不能写成的是注入形态 —— 标记块可以在块外保留用户内容，
 * 系统层要整份替换一个文件，配置键要改 JSON/TOML，CDP 则完全在别人的进程里。
 *
 * 四种形态只有三种能落地：`unavailable` 不是「还没做」，是「该目标自身把入口封死了」，
 * 这类目标必须带 `note` 说明原因，否则会被读成「待实现」。
 */

/** 注入形态。顺序即「层级由低到高」，见 `layerOf`。 */
export type InjectForm = "marker-block" | "system-layer" | "config-key" | "cdp" | "unavailable";

/** 注入点在提示词分层里的位置：载荷层最容易被驳回，配置层最难。 */
export type InjectLayer = "payload" | "system" | "config";

export type InjectPlatform = "win" | "mac" | "linux";

export interface InjectTarget {
	/** 稳定 id，用于工具参数与 state 文件。 */
	id: string;
	label: string;
	form: InjectForm;
	/** 写入点，允许 `~` 与 `%USERPROFILE%`；脚本负责展开。 */
	entry: string;
	/** 需要改的配置键（`system-layer` / `config-key` 必填）。 */
	configKey?: string;
	/** 该目标的技能目录；不声明表示它没有技能约定。 */
	skillsDir?: string;
	/** 支持平台。空数组表示不限。 */
	platforms: readonly InjectPlatform[];
	/** 形态不可用或需要额外条件时的原因。 */
	note?: string;
}

/** 标记块与上游注入器互认：两套装置装过的东西可以互相摘除。 */
export const INJECT_MARKER_BEGIN = "<!-- 寒霜破甲注入开始";
export const INJECT_MARKER_END = "<!-- 寒霜破甲注入结束 -->";

export const INJECT_TARGETS: readonly InjectTarget[] = [
	{
		id: "codex",
		label: "Codex",
		form: "marker-block",
		entry: "~/.codex/AGENTS.md",
		configKey: "model_instructions_file",
		skillsDir: "~/.codex/skills",
		platforms: ["win", "mac", "linux"],
		note: "config.toml 的 model_instructions_file 需要指向本文件；卸载要还原成原来的值。",
	},
	{
		id: "claude",
		label: "Claude",
		form: "marker-block",
		entry: "~/.claude/CLAUDE.md",
		skillsDir: "~/.claude/skills",
		platforms: ["win", "mac", "linux"],
	},
	{
		id: "opencode",
		label: "OpenCode",
		form: "system-layer",
		entry: "~/.config/opencode/agent/hanshuang.md",
		configKey: "default_agent",
		skillsDir: "~/.config/opencode/skills",
		platforms: ["win", "mac", "linux"],
		note: "只写 AGENTS.md 会被当成「本机偏好」驳回；正文必须落到 agent 定义里才成为系统提示词。",
	},
	{
		id: "cursor",
		label: "Cursor",
		form: "marker-block",
		entry: "~/.cursor/rules/hanshuang.mdc",
		platforms: ["win", "mac", "linux"],
		note: "规则文件按整份维护；项目级 .cursor/rules 需要每个项目各放一次。",
	},
	{
		id: "zcode",
		label: "ZCode",
		form: "marker-block",
		entry: "~/.zcode/AGENTS.md",
		platforms: ["win", "mac"],
		note: "系统提示词在应用包内（glm/zcode.cjs），改它需要整份备份；标记块只覆盖记忆层。",
	},
	{
		id: "dsh",
		label: "DeepSeek Harness",
		form: "marker-block",
		entry: "~/.dsh/AGENTS.md",
		skillsDir: "~/.dsh/skills",
		platforms: ["win", "mac", "linux"],
	},
	{
		id: "workbuddy-intl",
		label: "WorkBuddy（国际版）",
		form: "marker-block",
		entry: "~/.workbuddy-ai/MEMORY.md",
		skillsDir: "~/.workbuddy-ai/skills",
		platforms: ["win", "mac"],
		note: "记忆档案里的 memoryBlock 与 MEMORY.md 是两处，两处都要写才生效。",
	},
	{
		id: "workbuddy-cn",
		label: "WorkBuddy（国内版）",
		form: "marker-block",
		entry: "~/.workbuddy/MEMORY.md",
		skillsDir: "~/.workbuddy/skills",
		platforms: ["win", "mac"],
		note: "与国际化版同一套脚本，靠配置根区分。",
	},
	{
		id: "doubao",
		label: "豆包",
		form: "unavailable",
		entry: "(cloud memory via CDP)",
		platforms: ["win"],
		note: "macOS 客户端会重写自身命令行丢弃 --remote-debugging-port，调试端口不监听，CDP 建不起来；Windows 走同一路径。",
	},
];

export function targetById(id: string): InjectTarget | undefined {
	return INJECT_TARGETS.find(target => target.id === id);
}

/** 能在当前形态下真正写进去的目标：`unavailable` 不算。 */
export function usableTargets(): readonly InjectTarget[] {
	return INJECT_TARGETS.filter(target => target.form !== "unavailable");
}

/**
 * 注入点所在的层。
 *
 * 这个映射是解释用的：它说明为什么同一段正文写进 `AGENTS.md` 会被当成偏好驳回，
 * 写进 OpenCode 的 agent 定义却能生效。它**不**承诺「换层就一定不被拒」。
 */
export function layerOf(target: InjectTarget): InjectLayer {
	switch (target.form) {
		case "system-layer":
			return "system";
		case "config-key":
		case "cdp":
			return "config";
		case "unavailable":
			return "config";
		case "marker-block":
			return "payload";
	}
}

/** 计划里的一条写入：做什么、写哪儿、用户要准备什么。 */
export interface InjectWrite {
	path: string;
	/** `marker` = 块内替换；`whole` = 整份写入；`key` = 改一个配置键。 */
	kind: "marker" | "whole" | "key";
	/** 人读的一行说明。 */
	detail: string;
}

export interface InjectPlanInput {
	/** 提示词包名称，写进状态文件与块头。 */
	packLabel: string;
	/** 注入正文。 */
	body: string;
	/** state 文件路径（相对工作区或绝对路径，由调用方决定）。 */
	statePath?: string;
}

export interface InjectPlan {
	target: InjectTarget;
	form: InjectForm;
	layer: InjectLayer;
	writes: InjectWrite[];
	/** 有序步骤，第一步永远是可回滚的备份。 */
	steps: string[];
	/** 还原步骤。 */
	restore: string[];
	/** 这份计划做不到什么。 */
	warnings: string[];
	/** 生成脚本时用的块正文（含标记）。 */
	block: string;
	statePath: string;
}

const DEFAULT_STATE_PATH = "workbench/install-state.json";

/** 用标记块包住正文；与 `astravia-block.ts` 同一对标记。 */
export function wrapBlock(body: string, packLabel: string): string {
	const normalized = body.trim().replace(/\r\n/g, "\n");
	return [`${INJECT_MARKER_BEGIN} → ${packLabel} -->`, normalized, INJECT_MARKER_END, ""].join("\n");
}

/**
 * 生成一个目标的注入计划。
 *
 * 纯函数：不读文件、不猜「目标现在长什么样」。已存在内容的差异由脚本在执行时处理
 * （有标记块就替换块内，没有就追加），因为插件拿不到 `$HOME` 里的现状。
 */
export function planFor(target: InjectTarget, input: InjectPlanInput): InjectPlan {
	const statePath = input.statePath?.trim() || DEFAULT_STATE_PATH;
	const block = wrapBlock(input.body, input.packLabel);
	const warnings: string[] = [];

	const writes: InjectWrite[] = [];
	const steps: string[] = [];
	const restore: string[] = [];

	if (target.form === "marker-block") {
		writes.push({ path: target.entry, kind: "marker", detail: `在 ${target.entry} 内维护标记块，块外内容不动` });
		steps.push(`备份 ${target.entry} 到 ${target.entry}.hanshuang-backup-<时间戳>`);
		steps.push(`按标记写入：已有块则整块替换，没有则追加到文件末尾`);
		if (target.configKey) {
			writes.push({ path: target.entry.replace(/[^/\\]+$/, ""), kind: "key", detail: `确认 ${target.configKey} 指向本文件` });
			steps.push(`核对配置键 ${target.configKey}（不同版本写法不同，需人工确认后保存）`);
		}
		restore.push(`按标记摘除块（${INJECT_MARKER_BEGIN} … ${INJECT_MARKER_END} 之间）`);
		restore.push(`如需逐字节还原，用备份覆盖：${target.entry}.hanshuang-backup-*`);
	}

	if (target.form === "system-layer") {
		writes.push({ path: target.entry, kind: "whole", detail: `${target.entry} 整份写入（正文即系统提示词）` });
		steps.push(`备份 ${target.entry}（若已存在）到 ${target.entry}.hanshuang-backup-<时间戳>`);
		steps.push(`整份写入内核正文；该文件只由本工具维护，不掺入用户内容`);
		if (target.configKey) {
			writes.push({ path: "opencode.json", kind: "key", detail: `把 ${target.configKey} 指向本 agent 定义，改前整份备份、改后做 JSON 校验` });
			steps.push(`修改配置键 ${target.configKey}：先备份整份、写入、JSON 校验，失败自动回滚`);
		}
		restore.push(`删除 ${target.entry}（本工具装入的那份）`);
		restore.push(`把 ${target.configKey ?? "配置键"} 还原成安装前的值；原来没有这个键就删掉该键`);
		warnings.push("整份写入会覆盖同名文件的既有内容：安装前请确认它不是你自己维护的 agent 定义。");
	}

	if (target.form === "config-key" || target.form === "cdp") {
		writes.push({ path: target.entry, kind: "key", detail: `由目标的运行时改写，插件侧无法直接落盘` });
		steps.push("该形态需要驱动目标进程（或它的云端设置），插件只给步骤，不给脚本");
		restore.push("在该目标内手动清除对应的记忆 / 配置项");
		warnings.push("这一形态没有可执行脚本：写的是别人的进程或云端状态，回滚也只能在那边做。");
	}

	if (target.form === "unavailable") {
		warnings.push(target.note ?? "该目标在当前形态下不可注入。");
		steps.push("跳过：入口被封死，做了也不会生效");
	}

	steps.push(`记录到 ${statePath}：本次写入的文件、备份与标记块`);
	steps.push("执行后回读目标文件，确认标记块存在且块外内容未变");

	if (target.skillsDir) {
		steps.push(`（可选）把技能同步到 ${target.skillsDir}，只复制本插件自带的 skill 目录`);
	}
	return { target, form: target.form, layer: layerOf(target), writes, steps, restore, warnings, block, statePath };
}
