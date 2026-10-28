/**
 * 上游 14 个战例工程的**能力画像**，不和任何样本字节绑定。
 *
 * 上游把它们放在 `Tool/cases/项目A … 项目N`，每个目录是同一套工程契约：
 * `README.txt`（中英双语）、`build.ps1`、`docs/reverse-engineering.md`、`docs/algorithm.md`、
 * `src/`、`tools/`、`SHA256SUMS.txt`。契约本身比目录里的具体实现更值得对齐——
 * 实现是某个目标的成品，契约是「一条战例该怎么立项、怎么留证、怎么验收」。
 *
 * 这里只描述**方法与形状**：能力族、跨平台面、需要的工具链、阶段与证据门。
 * 一段代码、一个偏移都不搬：搬进来的 .ps1 / .dll 在这台机器上不可执行，
 * 只会变成审计脚本认不出的死文件。真正的实现由 `scaffold_case` 的 hpkit 工具在
 * 用户自己的目录里生成并自测（见 `cases/_shared`）。
 */

/** 插件能产出的命令面支持的操作系统。顺序即报告里的展示顺序。 */
export const OS_KEYS = ["win32", "darwin", "linux"] as const;
export type OsKey = (typeof OS_KEYS)[number];

/** 工程里 `src/` 需要的主语言，决定 build 脚本长什么样。 */
export const BUILD_LANGUAGES = ["c", "cs", "rs", "py", "java", "js"] as const;
export type BuildLanguage = (typeof BUILD_LANGUAGES)[number];

/** 双语文本。默认英文（与卡片/文档一致），中文放 `zh`。 */
export interface Localized {
	readonly en: string;
	readonly zh: string;
}

/** 能力族：决定阶段模板与默认工具链，也是 14 条与 19 个先例之间的对应键。 */
export type CaseCapability =
	| "auth-bypass"
	| "proxy-dll"
	| "binary-patch"
	| "script-pipeline"
	| "dotnet-activator"
	| "prefs-writer"
	| "python-activator"
	| "keygen"
	| "patch-engine"
	| "frida-dynamic"
	| "installer-lifecycle"
	| "native-hook"
	| "java-agent"
	| "vm-recovery";

export interface CasePhase {
	/** 稳定 id，证据表与报告中引用它。 */
	readonly id: string;
	readonly title: Localized;
	/** 这一阶段结束时必须拿得出的东西；写不出证据就是不成立。 */
	readonly evidence: Localized;
}

/** 工程自带的文档槽位，和上游 docs/ 下的文件名一一对应。 */
export const DOC_SLOTS = [
	"reverse-engineering",
	"algorithm",
	"protocol-and-patch",
	"protection-layers",
	"dll-hijack-and-agent",
	"functional-test",
] as const;
export type DocSlot = (typeof DOC_SLOTS)[number];

export interface CaseProject {
	/** 上游目录名里的字母，A–N。 */
	readonly id: string;
	readonly slug: string;
	readonly title: Localized;
	readonly capability: CaseCapability;
	/** 生成骨架时能落到哪些系统上。全部包含 linux：这是相对上游 .ps1 的硬要求。 */
	readonly platforms: readonly OsKey[];
	readonly languages: readonly BuildLanguage[];
	/** 外部工具名（自由文本，用来生成 `probe_environment` 的对照清单）。 */
	readonly toolchain: readonly string[];
	readonly phases: readonly CasePhase[];
	readonly docs: readonly DocSlot[];
	/** 对应的随包先例 slug，`cases/<slug>/` 里有可直接落盘的 hpkit 工具。 */
	readonly precedent: string;
	readonly note: Localized;
}

const PHASE = {
	baseline: {
		id: "baseline",
		title: { en: "Baseline and scope", zh: "基线与范围" },
		evidence: {
			en: "Target hash, version, and the authorisation line that names this asset.",
			zh: "目标哈希、版本，以及点名该资产的授权条款。",
		},
	},
	locate: {
		id: "locate",
		title: { en: "Locate the decision", zh: "定位判定点" },
		evidence: {
			en: "Function/offset that decides the outcome, with the cross-reference that reached it.",
			zh: "决定结论的函数/偏移，以及抵达它的交叉引用。",
		},
	},
	reproduce: {
		id: "reproduce",
		title: { en: "Reproduce the gate", zh: "复现判定" },
		evidence: {
			en: "Same input before and after, with exit codes — not a screenshot of a success state.",
			zh: "同一输入改前改后各跑一次并给退出码，不接受「成功截图」。",
		},
	},
	deliver: {
		id: "deliver",
		title: { en: "Ship the minimal artefact", zh: "交付最小产物" },
		evidence: {
			en: "Patch table or key material plus the rollback that restores the original bytes.",
			zh: "补丁表或密钥材料，以及能恢复原始字节的回滚步骤。",
		},
	},
	defense: {
		id: "defense",
		title: { en: "Defence in depth", zh: "纵深防御" },
		evidence: {
			en: "Client, transport and server-side remediation for the same weakness, each actionable.",
			zh: "同一弱点的客户端、传输层、服务端修复，每条都可落地。",
		},
	},
	unconfirmed: {
		id: "unconfirmed",
		title: { en: "State what is unconfirmed", zh: "写明未确认项" },
		evidence: {
			en: "An explicit list of what was inferred rather than observed, with the next command to settle it.",
			zh: "逐条列出推断而非观测的结论，并给出能定案的下一条命令。",
		},
	},
} as const satisfies Record<string, CasePhase>;

const ALL_OS: readonly OsKey[] = ["win32", "darwin", "linux"];

/**
 * 14 条。`capability` 是上游那条战例真正在演示的东西，不是它命中的产品类目；
 * `precedent` 指向随包先例，落盘时用它取可执行工具。
 */
export const CASE_PROJECTS: readonly CaseProject[] = [
	{
		id: "A",
		slug: "auth-bypass-injection",
		title: { en: "Client authorisation bypass with an injector", zh: "注入式客户端鉴权旁路" },
		capability: "auth-bypass",
		platforms: ALL_OS,
		languages: ["c", "py"],
		toolchain: ["radare2", "frida", "python3", "cc"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense, PHASE.unconfirmed],
		docs: ["reverse-engineering", "algorithm", "functional-test"],
		precedent: "client-auth-gate",
		note: {
			en: "Upstream also ships a hardening spec here; it is the defence half of the same case and belongs in the report, not in the payload.",
			zh: "上游这条同时带一份加固规范——它是同一战例的防御半边，属于报告，不属于 payload。",
		},
	},
	{
		id: "B",
		slug: "multiprocess-proxy-localisation",
		title: { en: "Multi-process client: proxy DLL and hot patches", zh: "多进程客户端：代理 DLL 与热补丁" },
		capability: "proxy-dll",
		platforms: ALL_OS,
		languages: ["c", "rs"],
		toolchain: ["radare2", "python3", "cc", "cargo"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense],
		docs: ["reverse-engineering", "protocol-and-patch"],
		precedent: "multiprocess-proxy-hotpatch",
		note: {
			en: "The interesting part is the patch-point table: an address is only reusable when its bytes are pinned to a build hash.",
			zh: "真正可复用的是补丁点表：地址只有在字节被钉到某个构建哈希上时才可复用。",
		},
	},
	{
		id: "C",
		slug: "binary-patch-runtime-licence",
		title: { en: "Binary patch with a runtime licence file", zh: "二进制补丁 + 运行时许可文件" },
		capability: "binary-patch",
		platforms: ALL_OS,
		languages: ["py"],
		toolchain: ["radare2", "python3"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense, PHASE.unconfirmed],
		docs: ["reverse-engineering", "algorithm"],
		precedent: "cardkey-online-runtime-patch",
		note: {
			en: "Licence state lives on disk as well as in memory; check both, and keep the file out of the patch.",
			zh: "许可状态同时在磁盘和内存里；两处都要看，且不要把配置文件打进补丁。",
		},
	},
	{
		id: "D",
		slug: "numbered-script-pipeline",
		title: { en: "Numbered script pipeline: scan to end-to-end", zh: "编号脚本流水线：扫描到端到端" },
		capability: "script-pipeline",
		platforms: ALL_OS,
		languages: ["py"],
		toolchain: ["python3", "radare2"],
		phases: [
			PHASE.baseline,
			{
				id: "locate",
				title: { en: "Scan, unpack, locate, sign", zh: "扫描、解包、定位、签名" },
				evidence: {
					en: "One numbered script per step, each rerunnable and each writing its own artefact.",
					zh: "每步一个编号脚本，均可重跑，且各自写出自己的中间产物。",
				},
			},
			PHASE.reproduce,
			PHASE.deliver,
			PHASE.defense,
		],
		docs: ["reverse-engineering", "algorithm"],
		precedent: "aob-signature-cross-version",
		note: {
			en: "This is the archetype the plugin's own tools/ layer copies: 00_scan … 06_e2e, one concern per number.",
			zh: "插件自己的 tools/ 层就是照这个范式做的：00_scan … 06_e2e，一个编号一件事。",
		},
	},
	{
		id: "E",
		slug: "dotnet-activator-hosts-guard",
		title: { en: ".NET activator with a hosts guard", zh: ".NET 激活器 + hosts 守卫" },
		capability: "dotnet-activator",
		platforms: ALL_OS,
		languages: ["cs"],
		toolchain: ["dotnet", "python3"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense],
		docs: ["reverse-engineering", "algorithm", "functional-test"],
		precedent: "dotnet-license-keygen",
		note: {
			en: "Hosts-file guarding is a side effect to restore, not a feature: record what was written before writing it.",
			zh: "hosts 守卫是可回滚的副作用而不是功能：写之前先记下写了什么。",
		},
	},
	{
		id: "F",
		slug: "prefs-writer-licence",
		title: { en: "Preferences writer for a licence blob", zh: "偏好写入式许可状态" },
		capability: "prefs-writer",
		platforms: ALL_OS,
		languages: ["cs"],
		toolchain: ["dotnet"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense],
		docs: ["reverse-engineering", "algorithm"],
		precedent: "dotnet-license-keygen",
		note: {
			en: "A prefs writer only proves the state is read; the decision still has to be located in code.",
			zh: "偏好写入只证明状态被读取；判定点仍然要在代码里定位。",
		},
	},
	{
		id: "G",
		slug: "python-activator-cli-gui",
		title: { en: "Python activator with CLI and GUI", zh: "Python 激活器：CLI + GUI" },
		capability: "python-activator",
		platforms: ALL_OS,
		languages: ["py"],
		toolchain: ["python3"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense, PHASE.unconfirmed],
		docs: ["reverse-engineering", "algorithm", "functional-test"],
		precedent: "cardkey-online-runtime-patch",
		note: {
			en: "Keep the algorithm in one importable module and let both front-ends call it; never fork the logic.",
			zh: "算法留在一个可导入的模块里，两个前端都调它，绝不复制一份逻辑。",
		},
	},
	{
		id: "H",
		slug: "offline-keygen-package",
		title: { en: "Offline keygen package with test vectors", zh: "离线 keygen 包 + 测试向量" },
		capability: "keygen",
		platforms: ALL_OS,
		languages: ["py"],
		toolchain: ["python3"],
		phases: [
			PHASE.baseline,
			PHASE.locate,
			{
				id: "reproduce",
				title: { en: "Reproduce against vectors", zh: "用测试向量复现" },
				evidence: {
					en: "Real accepted pairs plus a self-test that fails when the constant changes by one bit.",
					zh: "真实可用的一对输入输出，外加一个改一位常量就会失败的自测。",
				},
			},
			PHASE.deliver,
			PHASE.defense,
		],
		docs: ["reverse-engineering", "algorithm", "functional-test"],
		precedent: "ed25519-offline-keygen",
		note: {
			en: "Keygen without vectors is a guess; the vectors are the deliverable, the code is the by-product.",
			zh: "没有向量的 keygen 只是猜测：向量才是交付物，代码是副产品。",
		},
	},
	{
		id: "I",
		slug: "dotnet-patch-engine-rollback",
		title: { en: ".NET patch engine with rollback guard", zh: ".NET 补丁引擎 + 回滚守卫" },
		capability: "patch-engine",
		platforms: ALL_OS,
		languages: ["cs"],
		toolchain: ["dotnet", "python3"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense],
		docs: ["reverse-engineering", "algorithm", "functional-test"],
		precedent: "native-islicensed-patch",
		note: {
			en: "Binding to machine code makes the licence non-transportable; say so in the report instead of hiding it.",
			zh: "绑机器码会让许可不可迁移——写进报告，不要藏起来。",
		},
	},
	{
		id: "J",
		slug: "frida-dynamic-with-static-patch",
		title: { en: "Frida observation, then a static patch", zh: "Frida 先观测，再静态补丁" },
		capability: "frida-dynamic",
		platforms: ALL_OS,
		languages: ["js", "py"],
		toolchain: ["frida", "python3", "adb"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense, PHASE.unconfirmed],
		docs: ["reverse-engineering", "protocol-and-patch"],
		precedent: "android-ssl-pin-bypass",
		note: {
			en: "Hook first to see the real arguments; only patch bytes once the branch is proven reachable.",
			zh: "先 hook 看真实参数；分支可达被证明之后才动字节。",
		},
	},
	{
		id: "K",
		slug: "installer-lifecycle-reset",
		title: { en: "Install, reset and uninstall as one lifecycle", zh: "安装、重置、卸载是一条生命周期" },
		capability: "installer-lifecycle",
		platforms: ALL_OS,
		languages: ["py"],
		toolchain: ["python3"],
		phases: [PHASE.baseline, PHASE.reproduce, PHASE.deliver, PHASE.defense, PHASE.unconfirmed],
		docs: ["reverse-engineering", "functional-test"],
		precedent: "cardkey-online-runtime-patch",
		note: {
			en: "An uninstaller that cannot restore the machine is not a deliverable; ship the restore path with the install.",
			zh: "不能把机器还原的卸载器不算交付物：安装脚本必须和还原脚本一起发。",
		},
	},
	{
		id: "L",
		slug: "native-hook-bridge",
		title: { en: "Native hook plus an export bridge", zh: "原生 hook + 导出桥" },
		capability: "native-hook",
		platforms: ALL_OS,
		languages: ["c"],
		toolchain: ["cc", "radare2"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense, PHASE.unconfirmed],
		docs: ["reverse-engineering", "protocol-and-patch"],
		precedent: "qt-proxy-dll-gateway",
		note: {
			en: "The .def file is the specification: every forwarded export must keep its calling convention.",
			zh: "`.def` 就是规格书：每个转发导出都必须保持原调用约定。",
		},
	},
	{
		id: "M",
		slug: "java-agent-dll-hijack",
		title: { en: "Java agent loaded through a DLL hijack", zh: "借 DLL 劫持加载 Java agent" },
		capability: "java-agent",
		platforms: ALL_OS,
		languages: ["java", "rs"],
		toolchain: ["javac", "jar", "cargo"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense],
		docs: ["reverse-engineering", "dll-hijack-and-agent"],
		precedent: "java-agent-dll-hijack",
		note: {
			en: "Two artefacts, two rollbacks: the agent jar and the planted DLL are removed separately.",
			zh: "两件产物两套回滚：agent jar 与被放置的 DLL 分开清理。",
		},
	},
	{
		id: "N",
		slug: "vm-protection-layer-recovery",
		title: { en: "VM protection: three-layer recovery, minimal patch", zh: "VM 保护：三层恢复 + 最小补丁" },
		capability: "vm-recovery",
		platforms: ALL_OS,
		languages: ["py"],
		toolchain: ["radare2", "python3", "frida"],
		phases: [PHASE.baseline, PHASE.locate, PHASE.reproduce, PHASE.deliver, PHASE.defense, PHASE.unconfirmed],
		docs: ["reverse-engineering", "protection-layers"],
		precedent: "themida-dotnet-delegate-recovery",
		note: {
			en: "Upstream keeps its rejected experiments next to the accepted one; record the dead ends too, they stop the next attempt.",
			zh: "上游把被否决的实验和成立的方案放在一起；死胡同也要记，它能挡住下一次重试。",
		},
	},
];

export function findCaseProject(id: string): CaseProject | undefined {
	const key = id.trim().toUpperCase();
	return CASE_PROJECTS.find(project => project.id === key);
}

export function caseProjectSlugs(): string {
	return CASE_PROJECTS.map(project => `${project.id}=${project.slug}`).join(", ");
}

/** 14 条覆盖到的能力族数量，报告与自检页用它说明「结构对齐」不是一句口号。 */
export function capabilityCount(): number {
	return new Set(CASE_PROJECTS.map(project => project.capability)).size;
}
