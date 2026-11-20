/**
 * 「下一步」判断层：把体检结果翻成一条可执行的假设。
 *
 * 插件已经有检索（`search_cases`）、有工具、有 20 个先例包，但没有任何东西回答
 * 「**当前这个样本的下一步是什么**」。这一层补的就是那一格：输入是事实层产物
 * （格式 + 命中的规则 id），输出是一到三条 `NextStep`。
 *
 * 三条硬约定，缺一条这一层就会变成算命：
 *   1. 每条都是**假设**，不是结论 —— 措辞固定为「看起来像 X，验证方法 Y」；
 *   2. 每条都带**否证条件** —— 什么结果说明它不成立，以及不成立时退到哪里；
 *   3. 命中不了就给**兜底一步**（列先例 / 补事实），不编一个默认路径。
 *
 * 纯函数：不读文件、不跑进程、不依赖报告对象的结构细节，便于单测与在面板里复用。
 */

export type NextStepConfidence = "strong" | "weak" | "fallback";

export interface NextStepAction {
	/** 工具 id，与 `src/tools/ids.ts` 一致。 */
	tool: string;
	/** 参数写成可直接抄的形式。 */
	args: string;
	/** 一句话说这一步会给出什么证据。 */
	produces: string;
}

export interface NextStep {
	id: string;
	confidence: NextStepConfidence;
	/** 「看起来像什么」。 */
	hypothesis: string;
	action: NextStepAction;
	/** 否证条件；命中它说明假设不成立，按 `elseDo` 退。 */
	disproof: string;
	elseDo: string;
	/** 可引用的先例 slug 或文档 id。 */
	precedent?: string;
	doc?: string;
}

export interface NextStepInput {
	/** `report.target.format`，例如 apk / elf / pe。 */
	format: string;
	/** 报告里命中的规则 id（已去掉被用户关掉的）。 */
	ruleIds: readonly string[];
	/** 是否已经开过案卷；没开案时所有步骤前面多一句「先 init_task」。 */
	caseOpen?: boolean;
}

const has = (set: ReadonlySet<string>, ...ids: string[]): boolean => ids.some(id => set.has(id));

/** 按规则族 → 步骤。顺序即优先级：越靠前越先做。 */
export function planNextSteps(input: NextStepInput): NextStep[] {
	const rules = new Set(input.ruleIds);
	const format = input.format.toLowerCase();
	const isApk = format.includes("apk") || rules.size > 0 && [...rules].some(id => id.startsWith("apk."));
	const steps: NextStep[] = [];

	// 1) 壳 / 动态加载：先确认是不是「真代码不在磁盘上」，否则后面所有静态结论都无效。
	if (has(rules, "native.packed", "apk.dynamic-loading", "apk.native-loading", "archive.high-entropy-payload")) {
		steps.push({
			id: "unpack-first",
			confidence: "strong",
			hypothesis: "磁盘上的代码不是真正执行的代码：命中打包 / 动态加载 / 高熵载荷，静态读到的只是外壳。",
			action: {
				tool: "run_case_tool",
				args: isApk ? "slug=apk-dex-unpack tool=<entry>" : "slug=elf-packed-loader tool=<entry>",
				produces: "真实载荷的位置与入口（段表 / DEX 头 / 解密后镜像）",
			},
			precedent: isApk ? "apk-dex-unpack" : "elf-packed-loader",
			disproof: "若解包脚本报「未发现第二段镜像」，且 `scan_binary_strings` 在 `.text` 里能找到完整的业务字符串，则没有壳：回到静态分析。",
			elseDo: "放弃解包路径，直接做 `disassemble_range` + `list_code_symbols`。",
		});
	}

	// 2) 签名 / 完整性：决定「改动能不能落地」这一整类问题。
	if (has(rules, "apk.no-signature", "apk.signature-v1-only", "native.authenticode")) {
		steps.push({
			id: "signature-baseline",
			confidence: "strong",
			hypothesis: "签名方案不足以支撑「改动后仍被加载」：只有 v1 或干脆没有签名块。",
			action: {
				tool: "verify_signature",
				args: "path=<sample> mode=auto",
				produces: "v1/v2/v3 的实际情况 + 签者证书 SHA-256",
			},
			disproof: "若 `apksigner` 报 Verifies 且存在 v2/v3，签名就足以发现任何字节改动：后续补丁必须在运行时做，而不是改文件。",
			elseDo: "把结论写成「静态补丁不可行，只能动态验证」，并记进报告的边界段。",
		});
	}

	// 3) 可导出组件 / provider：契约类问题，直接把「谁可寻址」算清楚。
	if (has(rules, "apk.exported-component", "apk.exported-provider")) {
		steps.push({
			id: "exported-surface",
			confidence: "strong",
			hypothesis: "导出的组件构成了可寻址面；但「导出」不等于「无保护可达」。",
			action: {
				tool: "decompile_android",
				args: "operation=unpack apk_path=<sample> no_sources=true",
				produces: "明文 AndroidManifest 与 android:permission / exported 的逐项取值",
			},
			disproof: "若每个导出项都带 signature 级权限（如 BIND_QUICK_SETTINGS_TILE / MANAGE_DOCUMENTS），实际可达者只有系统：报告里不能写成「任意应用可调用」。",
			elseDo: "把逐组件权限列成表，只对真正无权限的那几项给修复建议。",
		});
	}

	// 4) 可执行内存 / 加固缺失：这是防御侧结论，不需要再「验证漏洞」，要的是记录 + 修补建议。
	if (has(rules, "native.rwx-segment", "native.executable-stack", "native.no-nx", "native.no-pie", "apk.debuggable", "apk.test-only")) {
		steps.push({
			id: "hardening-record",
			confidence: "weak",
			hypothesis: "二进制或包的加固项缺失（可写可执行段 / 可调试 / 无 PIE）。",
			action: {
				tool: "read_doc",
				args: "id=<matching defense doc>",
				produces: "与命中的加固项一一对应的修复做法，可直接写进报告的防御段",
			},
			disproof: "若这些属性只出现在「用户已自行剥离的构建」里，那它是构建配置问题而不是产品缺陷：报告里要降级为建议。",
			elseDo: "只保留一条结论「构建加固待补」，不单列为风险。",
		});
	}

	// 5) 明文流量 / 弱加密：需要一次运行时观察才有价值。
	if (has(rules, "apk.cleartext-traffic", "apk.weak-crypto")) {
		steps.push({
			id: "traffic-observe",
			confidence: "weak",
			hypothesis: "存在明文或弱算法路径，但静态只能看到「允许」，看不到「实际走」。",
			action: {
				tool: "generate_hook",
				args: "path=<sample> query=<cipher/host class> mode=observe",
				produces: "运行时实际调用到的 cipher / host，以及调用栈",
			},
			disproof: "若运行时从未命中那条路径，静态命中就是死代码：报告里应写「可达但未使用」。",
			elseDo: "把该规则降级为提示，不占风险分。",
		});
	}

	// 6) 兜底：没有任何规则命中时也要给一步，而且要说清「为什么给不出更强的假设」。
	if (steps.length === 0) {
		steps.push({
			id: "gather-facts",
			confidence: "fallback",
			hypothesis: "当前事实不足以形成假设：要么样本干净，要么命中的规则都不指向具体路径。",
			action: {
				tool: "search_cases",
				args: `query=${format || "sample"}`,
				produces: "同类目标已有的先例与它们的第一步",
			},
			disproof: "若先例检索返回空，说明这是新形态：改用 `scan_binary_strings` 找域名/路径/协议关键字，自下而上建假设。",
			elseDo: "打开命中的先例，按 docs/method.md 的第一步做。",
		});
	}

	// 把「先开案卷」前置成一条提醒，而不是悄悄塞进每条动作里。
	if (input.caseOpen === false) {
		steps.unshift({
			id: "open-case",
			confidence: "strong",
			hypothesis: "还没有案卷目录：任何结论都无法形成证据链。",
			action: {
				tool: "init_task",
				args: "name=<case> sample=<path>",
				produces: "scope.md / timeline.md / evidence/ 的骨架",
			},
			disproof: "若这次只是快速看一眼、不产出报告，可以跳过；但报告里就不能引用证据编号。",
			elseDo: "按 `docs/contract/case-library.md` 建目录，再回来走上面的步骤。",
		});
	}

	return steps;
}

/** 观测到的事实里，哪些规则算「强信号」——面板用它决定要不要把计划放在最上面。 */
export function strongStepCount(steps: readonly NextStep[]): number {
	return steps.filter(step => step.confidence === "strong").length;
}
