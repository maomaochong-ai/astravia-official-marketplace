import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { planFromBrief } from "../domain/planner";
import { renderLogo } from "../domain/engine/compose";
import { TOOL_LABELS } from "../contributions";
import { TOOL_PLAN } from "../tab-ids";

interface PlanToolInput {
	brief: string;
	brandName?: string;
	count?: number;
}

interface PlanToolResult {
	ok: boolean;
	brandName: string;
	candidates: {
		type: string;
		style: string;
		subject: string;
		detail: string;
		spec: unknown;
		rationale: string;
	}[];
	notes: string[];
}

/**
 * `logocreator_plan` — brief in, concrete specs out, with no image model involved.
 *
 * This is the piece that keeps the plugin useful on a text-only host session: the
 * agent does not have to invent `type`/`style`/`seed` values and hope they render,
 * it asks for candidates, reads the rationales, and passes the chosen spec to
 * `logocreator_design`. Everything here is deterministic, so the same brief always
 * plans the same three directions.
 */
export function createPlanTool(): PluginAgentToolRegistration<PlanToolInput> {
	return {
		id: TOOL_PLAN,
		name: TOOL_PLAN,
		label: TOOL_LABELS.plan,
		description: [
			"Turn a one-line brief into concrete logo specs, offline and deterministically — no image model, no key, no network.",
			"Use it when the user describes a logo in words (\"a leaf mark for a mountain teahouse\") and you want concrete `type`/`style`/`detail`/`seed` values instead of guessing: it returns three candidates with a one-line rationale each.",
			"Then call `logocreator_design` with the spec you chose (the returned `spec` is exactly what that tool accepts).",
			"Do NOT use it to render anything; it plans, `logocreator_design` draws.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				brief: { type: "string", description: "The user's own words, e.g. \"a leaf mark for a mountain teahouse, calm\"." },
				brandName: { type: "string", description: "Brand name when it is known separately from the brief." },
				count: { type: "integer", minimum: 1, maximum: 3, description: "How many candidates (default 3)." },
			},
			required: ["brief"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: ({ trigger }) => {
			const input = trigger.input ?? { brief: "" };
			const brief = String(input.brief ?? "").trim();
			if (!brief) return { ok: false, error: "brief is required" };

			const candidates = planFromBrief(brief, {
				brandName: input.brandName,
				count: Number(input.count) || 3,
			}).map((candidate) => {
				const rendered = renderLogo(candidate.spec);
				return {
					type: candidate.type,
					style: candidate.style,
					subject: rendered.subject,
					detail: candidate.spec.detail,
					spec: candidate.spec,
					rationale: candidate.rationale,
				};
			});

			return {
				ok: true,
				brandName: candidates[0]?.spec && (candidates[0].spec as { brandName: string }).brandName,
				candidates,
				notes: [
					"Deterministic: the same brief always plans the same three directions.",
					"Pass a candidate's `spec` straight to logocreator_design; keep its `seed`.",
				],
			} satisfies PlanToolResult;
		},
	};
}
