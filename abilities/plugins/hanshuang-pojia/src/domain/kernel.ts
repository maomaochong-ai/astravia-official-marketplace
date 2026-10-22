/**
 * 每个 Turn 动态注入的系统提示块。
 *
 * 为什么不写进 AGENTS.md：AGENTS.md 是常驻契约，每轮都在、有体积预算；
 * 这里的内容随**运行时状态**变化（lab 开关、用户正在看的页面、桥接能力），
 * 只有真正需要时才占用上下文。分工是：
 *   AGENTS.md  = 我是谁、怎么路由、守着哪些纪律
 *   kernel 块  = 此刻实验室开没开、用户在看哪一页、交付物要落到什么形状
 */

import type { LabState } from "./lab-mode";

export interface KernelInput {
	lab: LabState;
	/** 面板当前页面 id；宿主侧 hook 拿不到页面时传 null。 */
	page: string | null;
	/** 当前会话里可用的插件工具名。 */
	tools: readonly string[];
}

const PAGE_HINT: Record<string, string> = {
	overview: "the operator is on the overview page — start from the sample library or a path they pasted",
	findings: "the operator is reading findings — tie every claim to a rule id and an offset",
	strings: "the operator is reading extracted strings — cite byte offsets, never line numbers",
	disasm: "the operator is in the disassembler — prefer disassemble_range over describing assembly from memory",
	manifest: "the operator is reading the Android manifest — cite component names and export flags",
	entropy: "the operator is reading the entropy chart — name the section and the shannon value",
	signature: "the operator is comparing signature blocks — state which side carries the difference",
	compare: "the operator is diffing two builds — lead with the byte delta, then interpret it",
	docs: "the operator is in the field-document library — search_docs then read_doc before improvising",
	selfcheck: "the operator is on the health page — report failing checks as observed facts, not as caveats",
	reports: "the operator is reviewing saved reports — keep numbers identical to the report they are reading",
};

/**
 * lab 关闭时几乎不占空间：只声明当前状态与「不要假装有实验室环境」。
 * lab 开启时补上交付形状，因为此时用户期待的是一次真正的攻防交付。
 */
export function buildKernelBlock(input: KernelInput): string {
	const lines: string[] = [];

	lines.push(input.lab.enabled
		? `Lab mode: ON${input.lab.since ? ` (since ${input.lab.since.slice(0, 10)})` : ""}. The operator opted into the attack/defence workbench for this workspace.`
		: "Lab mode: OFF. Answer ordinary questions normally; do not expand shorthand into patch/keygen plans until the operator turns lab mode on with `lab：`.");

	if (input.tools.length > 0) {
		lines.push(`Plugin tools registered in this session: ${input.tools.join(", ")}. They read the workspace directly, so prefer them over re-deriving the same bytes by hand.`);
	}

	const hint = input.page ? PAGE_HINT[input.page] : undefined;
	if (hint) lines.push(`Current panel page: ${hint}.`);

	if (input.lab.enabled) {
		lines.push(
			[
				"Delivery shape while lab mode is on:",
				"1. Locate — the command / offset / symbol that reaches the check, with its evidence.",
				"2. Patch table — `address | original | patched | effect`, one row per site.",
				"3. Runnable artefact — script, keygen or patch file the operator can execute now.",
				"4. Verification — the same input replayed before and after, with exit codes.",
				"5. Rollback — the exact steps that restore the original bytes.",
				"Mark claims Observed / Inferred / Assumed. Two failed attempts of the same shape means change technique, not target.",
			].join("\n"),
		);
	}

	return lines.join("\n");
}

/** 注入块的 id 必须落在插件命名空间内，否则宿主会拒绝写入。 */
export const KERNEL_BLOCK_ID = "plugin.hanshuang-pojia.kernel";

/** 高于宿主默认引导、低于核心安全策略。 */
export const KERNEL_PRIORITY = 850;
