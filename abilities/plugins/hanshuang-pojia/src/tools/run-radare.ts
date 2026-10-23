import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { baseName, isOutsideProject, resolveSamplePath } from "../domain/sample-path";
import { specFor } from "../domain/toolchain/catalog";
import {
	MAX_CHARS,
	MAX_LIMIT,
	OPERATION_TOOL,
	planRadare,
	type DiffMode,
	type RadareOperation,
	type RadareOutputMode,
} from "../domain/toolchain/radare";
import { createCommandRunner, describeCommandFailure, probeOnce } from "../features/workbench/services/toolchain";

const OPERATIONS: RadareOperation[] = [
	"info",
	"strings",
	"functions",
	"disasm",
	"decompile",
	"xrefs",
	"asm",
	"diff",
	"cmd",
];

interface RunRadareInput {
	operation: RadareOperation;
	path?: string;
	other_path?: string;
	target?: string;
	output_mode?: RadareOutputMode;
	limit?: number;
	max_chars?: number;
	all_sections?: boolean;
	filter?: string;
	command?: string;
	analyze?: boolean;
	code?: string;
	arch?: string;
	bits?: number;
	disassemble?: boolean;
	diff_mode?: DiffMode;
}

export function registerRunRadareTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<RunRadareInput>({
		id: "run_radare",
		name: "run_radare",
		label: "%tool.radare.label%",
		description: [
			"Drive the user's own radare2 installation for work the in-plugin decoders cannot do: headers and",
			"format info (rabin2 -I), all strings including every section, the analysed function list, disassembly,",
			"pseudo-C, cross references, assemble/disassemble of a snippet (rasm2) and binary comparison (radiff2).",
			"",
			"operation: info | strings | functions | disasm | decompile | xrefs | asm | diff | cmd.",
			"output_mode shapes the answer and is the main defence against a wall of text:",
			"  full    — every line, paginated (default)",
			"  fold    — only branches, calls and comparisons (disasm) or statements (decompile)",
			"  summary — no instructions at all: function info, callers, callees",
			"target accepts a symbol name (`sym.main`) or an address (`0x1000`); it defaults to main.",
			"cmd passes the command straight to r2's `-c`, mirroring the upstream `seep_r2_cmd` zero-limit",
			"passthrough: `aaa; <command>` unless analyze=false. This channel keeps the argument vector intact, so",
			"shell features (pipes, redirects, `$()`, backticks) do not reach a shell. Any r2 command word is accepted.",
			"Because the channel runs the user's own r2 against the sample, it is best-effort and not a patch tool —",
			"for explicit write work use `r2 -w` through the host command channel (`agent.command.run`), where the",
			"write is explicit and logged.",
			"refused, and so is anything that leaves r2's own parser — a pipe, a redirect, `$(…)`, backticks, `=!` —",
			"because this channel keeps the argument vector intact. A byte edit is not off the table — run `r2 -w`",
			"through the host command channel (`agent.command.run`), where the write is explicit and logged.",
			"",
			"Requires radare2 on PATH and the user's approval for the command channel. If the tool reports that the",
			"host refused the call, the fix is the plugin's command declaration or its settings — not installing more",
			"software. Call probe_environment to see which executables are actually present.",
			"",
			"Nothing is executed from the sample: r2 reads bytes, and the caller must not ask it to open a debugger.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				operation: { type: "string", enum: OPERATIONS, description: "Which radare2 family query to run." },
				path: { type: "string", description: "Binary file. Required for every operation except asm." },
				other_path: { type: "string", description: "Second binary, required only for operation=diff." },
				target: { type: "string", description: "Symbol name or address for disasm/decompile/xrefs. Default main." },
				output_mode: {
					type: "string",
					enum: ["full", "fold", "summary"],
					description: "Answer shape; default full.",
				},
				limit: { type: "number", description: `Maximum rows to return (default 100, max ${MAX_LIMIT}).` },
				max_chars: { type: "number", description: `Hard character cap on the answer (max ${MAX_CHARS}).` },
				all_sections: { type: "boolean", description: "strings: include every section (-zz) instead of data (-z)." },
				filter: {
					type: "string",
					description: "strings/functions: substring filter. xrefs: 'to' (default) or 'from'.",
				},
				command: { type: "string", description: "cmd: the r2 command passed to `-c`, e.g. 'iI' or 'afl~main'." },
				analyze: { type: "boolean", description: "cmd: prefix the command with 'aaa' (default true)." },
				code: { type: "string", description: "asm: assembly text, or hex bytes when disassemble is true." },
				arch: { type: "string", description: "asm: architecture for rasm2, default x86." },
				bits: { type: "number", enum: [16, 32, 64], description: "asm: register width, default 64." },
				disassemble: { type: "boolean", description: "asm: disassemble the given hex instead of assembling text." },
				diff_mode: { type: "string", enum: ["code", "hex", "stats"], description: "diff: radiff2 mode, default code." },
			},
			required: ["operation"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		// `decompile` + `summary` can run three 120 s r2 passes back to back; the host must
		// outlast them or the user sees an empty result instead of the rendered one.
		timeoutMs: 420_000,
		handler: async context => {
			const input = context.trigger.input;
			const operation = input.operation;

			const run = createCommandRunner(ctx);
			if (!run) {
				return "External commands are unavailable: plugin.json#commands is empty or agent.command.run was not granted.";
			}

			let path = (input.path ?? "").trim();
			let otherPath = (input.other_path ?? "").trim();
			if (operation !== "asm") {
				if (!path) return `path is required for operation=${operation}.`;
				if (isOutsideProject(path, context.session.cwd)) {
					return `path must stay inside the open project: ${path}`;
				}
				try {
					path = resolveSamplePath(context.session.cwd, path);
				} catch (error) {
					return error instanceof Error ? error.message : String(error);
				}
			}
			if (operation === "diff") {
				if (!otherPath) return "other_path is required for operation=diff.";
				if (isOutsideProject(otherPath, context.session.cwd)) {
					return `other_path must stay inside the open project: ${otherPath}`;
				}
				try {
					otherPath = resolveSamplePath(context.session.cwd, otherPath);
				} catch (error) {
					return error instanceof Error ? error.message : String(error);
				}
			}

			const needed = OPERATION_TOOL[operation];
			let plan: ReturnType<typeof planRadare>;
			try {
				plan = planRadare({
					operation,
					path,
					otherPath,
					target: input.target,
					outputMode: input.output_mode,
					limit: input.limit,
					maxChars: input.max_chars,
					allSections: input.all_sections,
					filter: input.filter,
					command: input.command,
					analyze: input.analyze,
					code: input.code,
					arch: input.arch,
					bits: input.bits,
					disassemble: input.disassemble,
					diffMode: input.diff_mode,
				});
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}

			const spec = specFor(needed);
			const report = await probeOnce(run);
			const status = report.tools.find(tool => tool.id === needed);
			if (!status || !status.available) {
				const why = status?.blocked
					? `the host refused \`${spec.binary}\` (${status.detail}); declare it in plugin.json#commands and enable it in the plugin settings`
					: `\`${spec.binary}\` is not available (${status?.detail ?? "not probed"}); install it: ${spec.install}`;
				return `operation=${operation} needs ${spec.binary}, but ${why}. Run probe_environment for the full picture.`;
			}

			try {
				const results = [];
				for (const invocation of plan.invocations) {
					results.push(await run(invocation.file, invocation.args, { timeoutMs: invocation.timeoutMs }));
				}
				const header = path ? `${operation} · ${baseName(path)}${input.target ? ` · ${input.target}` : ""}` : `${operation}`;
				const body = plan.render(results);
				return `${header}\n${"-".repeat(Math.min(header.length, 72))}\n${body}`;
			} catch (error) {
				return describeCommandFailure(error);
			}
		},
	});
}
