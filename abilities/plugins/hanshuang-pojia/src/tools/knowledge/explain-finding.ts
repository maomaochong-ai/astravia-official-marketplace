/**
 * `explain_triage_finding`：解释规则本身，不重新分析文件。
 *
 * 两条边界写在描述里也写在实现里：只读插件自己的规则目录（`domain/audit/rules`），
 * 不做 CVE 查询、不联网。不给 id 就是目录清单，给错 id 由 `ruleFor` 负责给出可读结果。
 * 一次最多解释 `MAX_IDS` 条，超出的部分显式说明省略了多少条。
 */
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { RULES, ruleFor, SEVERITY_ORDER, SEVERITY_WEIGHT } from "../../domain/audit/rules";

interface ExplainFindingInput {
	ruleId?: string;
}

const MAX_IDS = 12;

export function registerExplainFindingTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<ExplainFindingInput>({
		id: "explain_triage_finding",
		name: "explain_triage_finding",
		label: "%tool.explain.label%",
		description: [
			"Explain one or more triage rule ids: what the rule checks, why it matters, how severe it is",
			"and what a reviewer should do next. Pass a comma-separated list to explain several at once,",
			"or omit the id to list the whole rule catalog.",
			"",
			"Use it after triage_binary when the user asks what a finding means, whether it is really a",
			"problem, or what to do about it.",
			"",
			"It only returns the plugin's own rule catalog — it does not re-analyse any file and it does",
			"not produce a CVE lookup.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				ruleId: {
					type: "string",
					description: "Rule id such as `apk.exported-component`, or a comma-separated list. Omit to list all rules.",
				},
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		handler: context => {
			const requested = (context.trigger.input.ruleId ?? "")
				.split(",")
				.map(item => item.trim())
				.filter(Boolean);
			if (requested.length === 0) {
				return [
					`# Triage rule catalog (${RULES.length} rules)`,
					"",
					...SEVERITY_ORDER.map(severity => {
						const rules = RULES.filter(rule => rule.severity === severity);
						if (rules.length === 0) return "";
						return [`## ${severity} (weight ${SEVERITY_WEIGHT[severity]})`, ...rules.map(rule => `- \`${rule.id}\` — ${rule.title}`), ""].join("\n");
					}).filter(Boolean),
				].join("\n");
			}
			const lines: string[] = ["# Rule reference", ""];
			for (const id of requested.slice(0, MAX_IDS)) {
				const rule = ruleFor(id);
				lines.push(
					`## \`${rule.id}\` — ${rule.title}`,
					"",
					`- Severity: ${rule.severity} (weight ${SEVERITY_WEIGHT[rule.severity]})`,
					`- Category: ${rule.category}`,
					`- Why it matters: ${rule.advice}`,
					"",
				);
			}
			if (requested.length > MAX_IDS) lines.push(`_${requested.length - MAX_IDS} further id(s) omitted._`, "");
			return lines.join("\n").trimEnd();
		},
	});
}
