/**
 * 按上游 14 条战例的**工程契约**生成一个案卷工程目录的内容（纯文本，不执行）。
 *
 * 契约取自上游每个 `项目A…N` 的共同形状：`README`（中英双语）、构建脚本、
 * `docs/reverse-engineering.md` + `docs/algorithm.md`、`src/`、`tools/`、`SHA256SUMS.txt`。
 * 生成物里没有一段搬来的代码：`src/` 只放「这里该写什么」的说明，
 * 可执行工具一律走 `scaffold_case`（hpkit，Python，三系统同源），因此不会产生
 * 「目录里有文件、机器上跑不了」的死文件。
 *
 * 所有内容与系统无关（除构建脚本），因此同一份案卷在 Linux 上照样能立起来。
 */
import { CASE_PROJECTS, type CaseProject, type DocSlot, type OsKey } from "./catalog";
import { buildScriptFor, buildScriptName, commandsFor, primaryLanguage } from "./commands";

export interface SkeletonFile {
	readonly path: string;
	readonly content: string;
}

export interface CaseProjectPlan {
	readonly id: string;
	readonly slug: string;
	readonly os: OsKey;
	/** 目标目录（绝对路径或相对项目根）；由调用方决定，这里只透传。 */
	readonly directory: string;
	readonly files: readonly SkeletonFile[];
	/** 建完之后可以直接粘进终端的命令。 */
	readonly commands: readonly string[];
}

export interface PlanOptions {
	readonly os: OsKey;
	/** 目标目录；缺省是 `<cwd>/<slug>`。 */
	readonly into?: string;
	readonly cwd?: string;
}

const DOC_TITLES: Record<DocSlot, { en: string; zh: string }> = {
	"reverse-engineering": { en: "Reverse engineering record", zh: "逆向过程记录" },
	algorithm: { en: "Algorithm and constants", zh: "算法与常量" },
	"protocol-and-patch": { en: "Protocol and patch points", zh: "协议与补丁点" },
	"protection-layers": { en: "Protection layers", zh: "保护层结构" },
	"dll-hijack-and-agent": { en: "DLL hijack and agent loading", zh: "DLL 劫持与 agent 加载" },
	"functional-test": { en: "Functional test guide", zh: "功能测试指南" },
};

function readme(project: CaseProject, os: OsKey): string {
	const phases = project.phases
		.map(phase => `| ${phase.id} | ${phase.title.en} / ${phase.title.zh} | ${phase.evidence.en} |`)
		.join("\n");
	const commands = commandsFor(project, os)
		.map(entry => `### ${entry.title.en} / ${entry.title.zh}\n\n\`\`\`\n${entry.command}\n\`\`\``)
		.join("\n\n");
	const docs = project.docs.map(slot => `- \`docs/${slot}.md\` — ${DOC_TITLES[slot].en} / ${DOC_TITLES[slot].zh}`).join("\n");

	return `# ${project.title.en} — case project ${project.id}

Archetype: \`${project.capability}\` · platforms: ${project.platforms.join(" / ")} ·
languages: ${project.languages.join(" / ")} · precedent: \`${project.precedent}\`

[EN] This directory is the engineering skeleton of one case. It carries the method and the
evidence gates, not a ready-made exploit: \`src/\` starts empty on purpose, and every runnable
tool comes from \`scaffold_case\` (hpkit), which self-tests before it reads a sample.

[ZH] 本目录是一条战例的工程骨架。它带的是方法与证据门，不是成品利用：\`src/\` 故意留空，
可执行工具一律来自 \`scaffold_case\`（hpkit），读样本之前先跑自测。

## Authorisation / 授权范围

- In scope / 范围内：只包含本项目 \`scope.md\` 里点名的资产。
- Out of scope / 范围外：任何线上第三方账号、他人凭据、未获授权的生产系统。
- \`scope.md\` 里的 \`auth.status=pending\` 只是占位：没有 \`granted\` 之前不动样本。

## Package contents / 套件内容

- \`README.md\` — 本文件（中英双语）
- \`${buildScriptName(os)}\` — 构建脚本，只查工具、构建 \`src/\`、写 \`SHA256SUMS.txt\`
${docs}
- \`src/README.md\` — 这里该写什么（${primaryLanguage(project)} 为主语言）
- \`tools/README.md\` — hpkit 工具与自测入口
- \`SHA256SUMS.txt\` — 构建后生成，用校验命令核对

## Evidence gates / 证据门

| phase | 名称 | 必须拿得出 |
| --- | --- | --- |
${phases}

一条写不出证据的阶段，就等于没做——不要用「看起来生效了」顶替退出码。

## Commands / 命令

${commands}

## Rollback / 回滚

先备份再动手：\`samples/original.bin\` 是唯一可信的还原源。反向打补丁只能证明你以为自己改了什么。

## Note / 备注

${project.note.en}

${project.note.zh}
`;
}

function reverseEngineeringDoc(project: CaseProject): string {
	return `# ${project.title.en} — reverse engineering record / 逆向过程记录

## 1. Target baseline / 目标基线

- 资产、版本、哈希（SHA-256）：
- 获取渠道与授权依据：
- 运行环境（系统 / 架构 / 依赖）：

## 2. Decision point / 判定点

定位到 **函数或偏移** 再写结论；只写「搜到了某个字符串」不算定位。

- 符号 / 地址：
- 抵达路径（交叉引用、调用者）：
- 命中证据（反汇编片段、伪代码、日志）：

## 3. Observation / 观测

先动态观察再静态改字节：分支可达是前提，不是结论。

- 运行方式（Frida / 调试器 / 单测）：
- 观测到的入参与返回值：
- 与上游/上一版本的差异：

## 4. Patch table / 补丁表

| address | original | patched | effect |
| --- | --- | --- | --- |
|  |  |  |  |

## 5. Verification / 验证

同一输入改前改后各跑一次，记录退出码或输出；不接受截图。

## 6. Unconfirmed / 未确认

逐条写，附下一条能定案的具体命令。
`;
}

function algorithmDoc(project: CaseProject): string {
	return `# ${project.title.en} — algorithm and constants / 算法与常量

## 1. Input and output / 输入输出

- 输入（字段、编码、长度约束）：
- 输出（结构、编码、校验位）：
- 调用点（哪个函数在什么时候算）：

## 2. Transform / 变换

按顺序写：每一步的输入、运算、常量、输出。常量写成十六进制并标注来源偏移。

## 3. Constants / 常量

| 名称 | 值 | 来源 |
| --- | --- | --- |
|  |  |  |

## 4. Test vectors / 测试向量

没有向量就不算还原：至少一组真实可用输入对。

| input | expected output | 来源 |
| --- | --- | --- |
|  |  |  |

## 5. Unconfirmed / 未确认

边界条件、异常分支、跨版本差异——写清楚哪一条没验证。
`;
}

function extraDoc(slot: DocSlot, project: CaseProject): string {
	const title = DOC_TITLES[slot];
	const body: Record<DocSlot, string> = {
		"reverse-engineering": "",
		algorithm: "",
		"protocol-and-patch": `## 协议面 / Protocol

- 端点、方法、请求头、签名参数：
- 状态码与语义（哪些是权威结论）：

## 补丁点 / Patch points

| 版本哈希 | address | original | patched | 复用条件 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

地址只有在字节被钉到构建哈希上时才可复用。
`,
		"protection-layers": `## 层结构 / Layers

1. 外层（壳 / 虚拟化 / 混淆）：
2. 中间层（校验、反调试、完整性）：
3. 业务层（真正的判定点）：

逐层写清「怎么看出来」与「怎么绕过或恢复」。三层没分清之前不要动字节。
`,
		"dll-hijack-and-agent": `## 劫持点 / Hijack point

- 被搜索的模块名与搜索顺序：
- 放置位置（与主程序同目录、PATH、服务路径）：
- 转发导出（\`.def\`）是否完整：

## Agent / Agent

- 加载方式（\`-javaagent\`、Attach、启动参数）：
- 注入类与入口方法：
- 两件产物分别怎么清理：
`,
		"functional-test": `## 验收 / Acceptance

| 场景 | 前置 | 操作 | 期望 | 实测 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

- 正常路径：
- 边界（空值、超长、异常编码）：
- 回滚后是否恢复原行为：
`,
	};
	return `# ${title.en} / ${title.zh} — ${project.slug}\n\n${body[slot]}`;
}

function srcReadme(project: CaseProject): string {
	const language = primaryLanguage(project);
	const hint: Record<string, string> = {
		c: "C：导出表照 `.def` 写全，每个转发函数保持原调用约定；用 `cc -shared` 构建。",
		cs: "C#：把算法放在一个可单测的静态类里，UI 只负责调用；`dotnet build` 构建。",
		rs: "Rust：`cdylib` 导出与 `.def` 对齐，`cargo build --release` 构建。",
		py: "Python：算法放进可导入模块，CLI 与 GUI 都调它；`python3 -m compileall` 校验语法。",
		java: "Java：agent 的 `premain`/`agentmain` 必须是唯一入口，`javac` + `jar` 构建。",
		js: "JavaScript：Frida 脚本只做观测与最小覆写，不改业务流程。",
	};
	return `# src/ — ${project.slug}

这里**故意是空的**。骨架不预置实现：预置的代码在别的系统上跑不了，就会变成
「目录里有文件、机器上执行不了」的死文件——那正是这次要避免的东西。

主语言：**${language}**。${hint[language] ?? ""}

建议的落盘顺序：

1. 先在 \`tools/\` 里用 hpkit 把「定位 + 复现」跑通（自测绿了再碰真样本）；
2. 证据齐了，再把最小实现搬进 \`src/\`；
3. \`${buildScriptName("linux")}\` / \`build.ps1\` 能构建、能出校验和，才算交付。
`;
}

function toolsReadme(project: CaseProject, os: OsKey): string {
	const test = commandsFor(project, os).find(entry => entry.id === "selftest");
	return `# tools/ — 可执行工具

工具来自随包先例 \`${project.precedent}\`，由 \`scaffold_case\` 落盘（hpkit，Python，三系统同源）。
不要在这里放 PowerShell 一次性脚本：换一台机器就跑不了，也不会有人再跑第二次。

## 落盘

用 \`scaffold_case\`（\`precedent="${project.precedent}"\`）把工具写进本目录，然后先自测：

\`\`\`
${test?.command ?? "python3 -m unittest discover -s tools -v"}
\`\`\`

## 约定

- 每个工具支持 \`--self-test\`：不依赖真实样本也能跑，绿了才允许读目标；
- 输出必须是可复核的文本（偏移、原始字节、期望字节），不是「成功」两个字；
- 失败时打印**它检查了什么**，不要只说 failed。
`;
}

/** 生成整份计划。纯函数：同输入同输出，便于测试与报告引用。 */
export function planCaseProject(project: CaseProject, options: PlanOptions): CaseProjectPlan {
	const directory = options.into ?? (options.cwd ? `${options.cwd}/${project.slug}` : project.slug);
	const files: SkeletonFile[] = [
		{ path: "README.md", content: readme(project, options.os) },
		{ path: "docs/reverse-engineering.md", content: reverseEngineeringDoc(project) },
		{ path: "docs/algorithm.md", content: algorithmDoc(project) },
		...project.docs
			.filter(slot => slot !== "reverse-engineering" && slot !== "algorithm")
			.map(slot => ({ path: `docs/${slot}.md`, content: extraDoc(slot, project) })),
		{ path: "src/README.md", content: srcReadme(project) },
		{ path: "tools/README.md", content: toolsReadme(project, options.os) },
		{ path: buildScriptName(options.os), content: buildScriptFor(project, options.os) },
	];

	return {
		id: project.id,
		slug: project.slug,
		os: options.os,
		directory,
		files,
		commands: commandsFor(project, options.os).map(entry => entry.command),
	};
}

/** 给工具返回值用的摘要：写了哪些文件、下一步跑什么。 */
export function renderCaseProjectPlan(plan: CaseProjectPlan, written: readonly string[], skipped: readonly string[]): string {
	const lines = [
		`# case project ${plan.id} — ${plan.slug} (${plan.os})`,
		`directory: ${plan.directory}`,
		"",
		`files written (${written.length}):`,
		...written.map(path => `- ${path}`),
	];
	if (skipped.length > 0) {
		lines.push("", `left alone (${skipped.length}, pass overwrite=true to replace):`, ...skipped.map(path => `- ${path}`));
	}
	lines.push(
		"",
		"next, in this order:",
		...plan.commands.map((command, index) => `${index + 1}. ${command}`),
		"",
		"nothing was executed and no sample was read. src/ is intentionally empty: fill it only after",
		"the tools' self-tests pass and the evidence gates in README.md are satisfied.",
	);
	return lines.join("\n");
}

/** 全部 14 条的目标目录名，自检页与文档索引共用。 */
export function allProjectSlugs(): string[] {
	return CASE_PROJECTS.map(project => project.slug);
}
