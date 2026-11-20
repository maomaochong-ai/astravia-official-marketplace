/**
 * `plan_next_step` —— 把「体检结果」翻成一条可执行的假设。
 *
 * 插件此前能检索先例、能跑工具、能出报告，但没有东西回答「下一步做什么」：
 * 20 个先例、44 条路由、346 篇文档摆在那里，选择权全落在读者身上。
 * 这个工具补的是选择本身，并且**每一项都带否证条件** ——
 * 没有否证条件的分诊就是算命。
 *
 * 它不读面板状态、不跑进程：只要格式与命中的规则 id。因此同一份输入在任何地方
 * 都给出同一份计划，可以单测，也可以在面板里直接复用（见指南页）。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { planNextSteps, type NextStep } from "../../domain/case/next-step";

interface PlanInput {
	/** 样本格式，例如 apk / elf / pe / macho。 */
	format?: string;
	/** 命中的规则 id，逗号或空格分隔。 */
	rules?: string;
	/** 是否已经有案卷。省略时不提醒开案。 */
	caseOpen?: boolean;
}

const CONFIDENCE_TONE: Record<NextStep["confidence"], string> = {
	strong: "强信号",
	weak: "弱信号",
	fallback: "兜底",
};

function splitRules(raw: string | undefined): string[] {
	return (raw ?? "")
		.split(/[,\s]+/)
		.map(item => item.trim())
		.filter(Boolean);
}

function render(steps: readonly NextStep[], input: PlanInput): string {
	if (steps.length === 0) {
		return [
			"# 下一步计划",
			"",
			"没有可给的步骤：输入为空。至少给 `format` 或一条 `rules`。",
			"",
			"例：`plan_next_step format=apk rules=apk.exported-component,apk.signature-v1-only`",
		].join("\n");
	}

	const lines = [
		`# 下一步计划 · ${input.format || "(未给格式)"} · ${steps.length} 步`,
		"",
		"下面是**假设**，不是结论。每一步都写明「什么结果说明它不成立」——先做否证，再谈结论。",
		"",
	];
	for (const [index, step] of steps.entries()) {
		lines.push(`## ${index + 1}. ${step.hypothesis}`);
		lines.push("");
		lines.push(`- 置信：**${CONFIDENCE_TONE[step.confidence]}**（\`${step.id}\`）`);
		lines.push(`- 动作：\`${step.action.tool} ${step.action.args}\``);
		lines.push(`- 会得到：${step.action.produces}`);
		lines.push(`- 否证：${step.disproof}`);
		lines.push(`- 若不成立：${step.elseDo}`);
		if (step.precedent) lines.push(`- 先例：\`${step.precedent}\`（\`search_cases precedent=${step.precedent}\` 拿全文）`);
		if (step.doc) lines.push(`- 文档：\`${step.doc}\``);
		lines.push("");
	}
	lines.push("计划到此为止：这些动作都需要你自己或宿主 Agent 执行，插件不代跑（`run_case_tool` 除外，它先过 self-test）。");
	return lines.join("\n");
}

export function registerPlanNextStepTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<PlanInput>({
		id: "plan_next_step",
		name: "plan_next_step",
		label: "%tool.planNextStep.label%",
		description: [
			"Turn a triage result into the next concrete step: hypothesis, the tool to run, what it produces,",
			"and — mandatory — the result that would disprove the hypothesis.",
			"",
			"Pass `format` and the `rules` that fired (comma or space separated ids from the report).",
			"Output is one to three steps ordered by priority, each with a disproof condition and a fallback.",
			"Nothing is executed and nothing is read from disk: the same input always yields the same plan,",
			"so it can be reviewed before anyone runs a tool.",
			"",
			"Use it right after `triage_binary` when the report lists findings but the next move is not obvious.",
			"Set `caseOpen: false` to prepend the `init_task` reminder when no case directory exists yet.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				format: { type: "string", description: "Sample format: apk / elf / pe / macho / zip." },
				rules: { type: "string", description: "Rule ids that fired, comma or space separated." },
				caseOpen: { type: "boolean", description: "Whether a case directory already exists." },
			},
			required: [],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		timeoutMs: 30_000,
		handler: async ({ trigger }) => {
			const input = trigger.input;
			const rules = splitRules(input.rules);
			const format = (input.format ?? "").trim();
			if (rules.length === 0 && format.length === 0) {
				return "plan_next_step needs `format` or at least one rule id. Run `triage_binary` first and pass the rule ids it reported.";
			}
			return render(planNextSteps({ format, ruleIds: rules, caseOpen: input.caseOpen }), input);
		},
	});
}
