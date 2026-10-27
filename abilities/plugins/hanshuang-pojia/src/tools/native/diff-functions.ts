import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { renderSemanticDiff, semanticDiff } from "../../domain/native/semantic-diff";
import { loadSample } from "../lib/read-sample";

interface DiffFunctionsInput {
	path?: string;
	otherPath?: string;
	maxFunctions?: number;
}

const MAX_FUNCTIONS = 400;

export function registerDiffFunctionsTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<DiffFunctionsInput>({
		id: "diff_functions",
		name: "diff_functions",
		label: "%tool.diffFunctions.label%",
		description: [
			"Compare two builds of the same ELF / PE / Mach-O by function instead of by byte: every function is",
			"fingerprinted from its decoded instructions, matched by symbol name first and by instruction shape",
			"second, then reported as same / constants-only / changed / renamed / added / removed.",
			"",
			"`same` means identical instruction bytes. `constants-only` means the instruction shapes match while",
			"operands differ — the register allocation or an immediate changed, which is exactly what a patched",
			"gate looks like. `changed` means the shape itself differs. Matching by shape after name matching is",
			"what lets a renamed or relinked function still line up.",
			"",
			"Use it to answer 'what changed between these two builds?', 'is this the same binary with one check",
			"patched?', or 'did my rebuild only move addresses?'. For a raw byte diff of the same two files use",
			"diff_binaries instead; this tool deliberately normalises addresses away and would hide them.",
			"",
			"It reads both files, decodes every candidate function and never executes either sample. Stripped",
			"images still work: candidates come from call targets as well as symbols, but unnamed functions are",
			"matched by shape only, so a stripped pair yields fewer name-based matches.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Baseline sample, absolute or relative to the session working directory." },
				otherPath: { type: "string", description: "Second sample, usually the newer build." },
				maxFunctions: { type: "integer", description: `Functions to fingerprint per side (default ${MAX_FUNCTIONS}).` },
			},
			required: ["path", "otherPath"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 180_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const [left, right] = await Promise.all([
					loadSample(context.host.fs, context.session.cwd, input.path ?? ""),
					loadSample(context.host.fs, context.session.cwd, input.otherPath ?? ""),
				]);
				const diff = semanticDiff(left.bytes, right.bytes, { maxFunctions: Math.max(1, Math.min(MAX_FUNCTIONS, input.maxFunctions ?? MAX_FUNCTIONS)) });
				const body = renderSemanticDiff(diff);
				const head = [`# ${left.name} → ${right.name}`, ""];
				const notes = [...new Set([...diff.left.warnings, ...diff.right.warnings])];
				if (notes.length > 0) head.push(...notes.map(note => `- ${note}`), "");
				return [...head, body].join("\n");
			} catch (error) {
				return `Function diff failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}
