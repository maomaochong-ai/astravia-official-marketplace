import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import {
	ARTIFACT_KINDS,
	ARTIFACT_LANGS,
	generateArtifact,
	type ArtifactKind,
	type ArtifactLang,
} from "../../domain/artifact/generators";

interface GenerateArtifactInput {
	kind?: ArtifactKind;
	lang?: ArtifactLang;
	target?: string;
	locate?: string;
	site_line?: string[];
	test_vector?: string[];
}

/** 结尾一句说清每形态产的是「最小可执行骨架」而非成品。 */
const KIND_NOTE: Record<ArtifactKind, string> = {
	patch:
		"This is a minimal patch skeleton scoped to the locate point you supplied. It copies the original first, only writes the cited bytes, and carries the Copy-first + four-artifact verification. Fill the offsets from real Locate output, never from memory.",
	keygen:
		"This is a keygen skeleton scoped to the verify check you located. It reproduces the target's constants/transform in reverse; your test vectors drive which inputs must be accepted. The real check function decides, not this file.",
	"proxy-dll":
		"This is a proxy-DLL stub skeleton, not a finished forwarder: enumerate the target's real export table with `list_code_symbols`, then fill each forwarding function and its interposition point. No private addresses are pre-written.",
	verify:
		"This is the VERIFICATION leg of the four-artifact flow. Run the same input against the unmodified and the patched copy and compare; the verdict follows real replay output, not static optimism.",
};

export function registerGenerateArtifactTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<GenerateArtifactInput>({
		id: "generate_artifact",
		name: "generate_artifact",
		label: "%tool.artifact.label%",
		description: [
			"Generate a runnable scaffolding source file for a local-sample check, scoped to the decision point you located.",
			"",
			"kind picks the artifact shape:",
			"  patch — minimal byte-patch skeleton with a patch table (address | original | patched) and Copy-first + four-artifact verification",
			"  keygen — key constructor skeleton that reproduces the located verify check's constants/transform in reverse, with test vectors",
			"  proxy-dll — proxy-DLL forwarding/interposition scaffold (call `list_code_symbols` first to fill the export table)",
			"  verify — verification harness that replays the same input against the unmodified and the patched copy and compares",
			"",
			"`lang` selects the language shape (python, c, js; python default). `target` is a display name for the sample. `locate` is the",
			"routing line that reaches the gate (command / offset / symbol) and is echoed into the file header so the skeleton stays traceable.",
			"",
			"Everything is generated in-process from your inputs and returned as text (a fenced source block) — nothing is written to disk and",
			"no offsets, hashes or symbols are fabricated: fill the cited bytes from real Locate/verification output.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				kind: {
					type: "string",
					enum: [...ARTIFACT_KINDS],
					description: "Which artifact scaffold to generate (patch | keygen | proxy-dll | verify).",
				},
				lang: {
					type: "string",
					enum: [...ARTIFACT_LANGS],
					description: "Language shape for the skeleton (python default).",
				},
				target: { type: "string", description: "Display name of the sample, echoed into the header." },
				locate: { type: "string", description: "The routing line that reaches the gate (command / offset / symbol); echoed into the header." },
				site_line: {
					type: "array",
					items: { type: "string" },
					description: "patch only: one patch-table row per site, `address | original | patched`.",
				},
				test_vector: {
					type: "array",
					items: { type: "string" },
					description: "keygen only: expected input => key vectors, one per line.",
				},
			},
			required: ["kind"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 30_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const kind: ArtifactKind | undefined = [...ARTIFACT_KINDS].find(k => k === input.kind);
				if (!kind) return `generate_artifact needs a valid \`kind\` (${ARTIFACT_KINDS.join(" | ")}).`;
				const lang: ArtifactLang = [...ARTIFACT_LANGS].find(l => l === input.lang) ?? "python";

				const text = generateArtifact({
					kind,
					lang,
					target: input.target?.trim() ?? "",
					locate: input.locate?.trim() ?? "",
					siteLines: (input.site_line ?? []).map(s => s.trim()).filter(Boolean),
					testVectors: input.test_vector ?? [],
				});
				return `${text}\n\n${KIND_NOTE[kind]}`;
			} catch (error) {
				return `Artifact generation failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}