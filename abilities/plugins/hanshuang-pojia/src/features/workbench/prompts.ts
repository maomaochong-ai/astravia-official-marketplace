/** 发给 Agent 时需要的上下文；字段都可缺省，缺省时 prompt 用中性说法。 */
export interface PromptTarget {
	name: string;
	path: string;
	format: string;
	score: number;
	grade: string;
	findings: number;
}

export interface PromptContext {
	target?: PromptTarget;
	/** finding 动作：规则 id 与标题。 */
	ruleId?: string;
	findingTitle?: string;
	/** 另一个样本名（compare）或数量说明（strings）。 */
	other?: string;
	extra?: string;
}

/**
 * 面板每个紫色按钮发出去的指令。
 *
 * 三条纪律：
 * 1. 一律英文——这段文字进入 Agent 的上下文，和工具描述保持同一语言；
 * 2. 明确要求 Agent 用插件工具取全量数据，而不是复述面板里已截断的摘要；
 * 3. 只要求静态分析，不要求 hook / patch / 绕过，越界请求在 SKILL 层也会被拒。
 */

export type PromptAction =
	| "continue"
	| "finding"
	| "disasm"
	| "docs"
	| "findings-summary"
	| "permissions"
	| "strings"
	| "entropy"
	| "signature"
	| "compare"
	| "report"
	| "harden"
	| "toolchain";

function subject(context: PromptContext): string {
	const target = context.target;
	if (!target) return "the sample currently open in the Hanshuang Pojia panel";
	return `\`${target.path}\` (${target.format.toUpperCase()}, ${target.name})`;
}

function verdict(context: PromptContext): string {
	const target = context.target;
	if (!target) return "";
	return ` The panel scored it ${target.score}/100 (grade ${target.grade}) across ${target.findings} finding(s).`;
}

export function buildPrompt(action: PromptAction, context: PromptContext = {}): string {
	switch (action) {
		case "continue":
			return [
				`Continue the static triage of ${subject(context)} that I started in the Hanshuang Pojia panel.${verdict(context)}`,
				"Call triage_binary in full mode for the complete rule set, then walk me through the three findings that drive the score and what each one implies for the people installing this build.",
				"Keep it to static evidence: no execution, no patching, no unpacking steps I would have to run.",
			].join("\n");
		case "finding":
			return [
				`Explain this finding from the Hanshuang Pojia report on ${subject(context)}:`,
				`rule \`${context.ruleId ?? "unknown"}\` — ${context.findingTitle ?? "see the panel"}.`,
				"Say what the evidence actually proves, what it cannot prove, and the smallest concrete change that would clear it.",
				"If the rule fired on several components or entries, list them; call explain_triage_finding rather than guessing the rule semantics.",
			].join("\n");
		case "findings-summary":
			return [
				`Summarise every finding the Hanshuang Pojia panel has collected${context.target ? ` in this session around ${subject(context)}` : ""}.`,
				"Group them by severity, mark which ones share a root cause, and rank them by what a reviewer should fix first.",
				"Use triage_binary in full mode for anything the panel only summarised.",
			].join("\n");
		case "permissions":
			return [
				`Review the declared permissions and components of ${subject(context)}.`,
				"Call triage_binary in full mode, then split the permissions into runtime-granted, special-access and ordinary platform permissions.",
				"For each exported component say whether another app can reach it without a permission, and name the permission that would close the gap.",
			].join("\n");
		case "strings":
			return [
				`Deep-scan the strings in ${subject(context)} with scan_binary_strings.`,
				`Focus on endpoints, hosts, credentials-shaped values and storage paths; the panel only sampled ${context.extra ?? "a bounded set"} of them.`,
				"Report only values that are actually present in the file, quote them verbatim, and say which ones look like placeholders or test fixtures.",
			].join("\n");
		case "entropy":
			return [
				`Interpret the entropy profile and hardening flags the Hanshuang Pojia panel shows for ${subject(context)}.`,
				"Call triage_binary in full mode and explain which high-entropy regions are consistent with packing, encryption or plain compressed assets, and what that means for static analysis.",
				"Be explicit about which hardening facts are parsed and which are simply not checked by this engine.",
			].join("\n");
		case "signature":
			return [
				`Explain the signing story of ${subject(context)}.`,
				"The panel detects v1 / v2 / v3 structurally and does not verify digests, so use triage_binary for the raw facts and tell me which scheme protects what.",
				"Name the command a reviewer should run to verify the certificate chain on a real machine, and flag the risk of a v1-only or unsigned build.",
			].join("\n");
		case "compare":
			return [
				`Compare two builds I analysed in the Hanshuang Pojia panel: ${context.target?.name ?? "build A"} and ${context.other ?? "build B"}.`,
				"Call diff_binaries on both paths to establish byte-level changes, then compare the permission and component sets from triage_binary.",
				"Say which differences change the risk profile and which are cosmetic.",
			].join("\n");
		case "report":
			return [
				`Write the reviewer-facing summary for ${subject(context)} from the Hanshuang Pojia report.${verdict(context)}`,
				"Structure it as: what this build is, what stands out, what the risk score is made of, what was not checked, and the next three actions.",
				"Keep every claim traceable to a rule id or a parsed fact; do not invent behaviour you have not seen in the file.",
			].join("\n");
		case "harden":
			return [
				`Turn the Hanshuang Pojia findings on ${subject(context)} into a remediation plan for the app's own developers.`,
				"For each finding give the code or manifest change, the verification step, and the risk of not doing it.",
				"Order the list by severity, and mark anything that needs a rebuild rather than a config change.",
			].join("\n");
		case "toolchain":
			return [
				"The Hanshuang Pojia panel runs a pure TypeScript engine, so it cannot see jadx, apktool, radare2, Ghidra or IDA on this machine.",
				`Check what is actually reachable for deeper work on ${subject(context)}: whether the workbench kit's seep MCP server answers seep_status and which of radare2 / jadx / apktool / its knowledge base it reports, whether the ida MCP server is connected, and which of jadx / apktool / radare2 / IDA is installed on its own, with the version.`,
				"Then say which one you would use and what it buys me over the panel. If IDA is absent, go through the seep radare2 path instead of stopping.",
				"Do not install anything without asking me first.",
			].join("\n");
		case "disasm":
			return [
				`Read the function the Hanshuang Pojia panel is disassembling in ${subject(context)}${context.other ? ` (${context.other})` : ""}.`,
				"The panel ships its own linear-sweep decoder and control-flow builder, so treat its listing as a starting point, not ground truth: call disassemble_range around the same offsets for a second opinion and say where the two disagree.",
				"Then reconstruct what the function does: arguments, return value, the branch that decides behaviour, and any string or global it touches. Quote offsets verbatim and mark anything you inferred rather than read.",
				"Stay static — no execution, no patching, no hooking.",
			].join("\n");
		case "docs":
			return [
				`I am reading the workbench kit's own write-up in the Hanshuang Pojia panel${context.other ? ` (${context.other})` : ""}.`,
				`Continue from that document as the authority for ${subject(context)}: quote the parts that apply, say which step you are following, and point out where the text and the sample disagree.`,
				"If the document stops short of the case at hand, say exactly which question is left open instead of filling it in.",
			].join("\n");
		default:
			return `Continue the static triage of ${subject(context)}.`;
	}
}