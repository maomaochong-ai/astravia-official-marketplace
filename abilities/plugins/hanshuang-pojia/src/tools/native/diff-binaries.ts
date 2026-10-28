/**
 * `diff_binaries`：原始字节比对，回答「这两个构建差在哪」。
 *
 * 只比字节：不做节区感知、重定位感知或语义比对，也不解释某个字节变了意味着什么。
 * 相同字节的连续段会折叠成 hunk，所以 20 MiB 安装包里改一处校验只会出一两个块。
 * 不写盘、不打补丁、不执行样本。
 */
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { diffBytes } from "../../domain/diff";
import { loadSample } from "../lib/read-sample";
import { publishToolResult } from "../../runtime/panel-channel";

interface DiffBinariesInput {
	path?: string;
	otherPath?: string;
	maxHunks?: number;
}

export function registerDiffBinariesTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<DiffBinariesInput>({
		id: "diff_binaries",
		name: "diff_binaries",
		label: "%tool.diff.label%",
		description: [
			"Compare two samples byte by byte and report what actually changed: identical or not, both sizes,",
			"the number of differing bytes, and hunks with the differing bytes from each side in hex.",
			"Aligned runs of equal bytes collapse, so a single patched region in a 20 MiB installer shows up",
			"as one or two hunks instead of a wall of noise.",
			"",
			"Use it to answer 'what changed between these two builds?', 'is this the same binary with a",
			"patched check?', or 'did my rebuild only touch the version resource?'. Both samples must be",
			"readable by the plugin (inside the open project, at most 32 MiB each).",
			"",
			"It compares raw bytes only: no section-aware, relocation-aware or semantic diff, and no",
			"interpretation of what a changed byte means. Follow up with list_code_symbols or disassemble_range",
			"on the changed region. It never patches, writes to, or executes either sample.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "First sample, absolute or relative to the session working directory." },
				otherPath: { type: "string", description: "Second sample, usually the newer build." },
				maxHunks: { type: "integer", description: "Maximum hunks to report (default 40, max 500)." },
			},
			required: ["path", "otherPath"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 120_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const left = await loadSample(context.host.fs, context.session.cwd, input.path ?? "");
				const right = await loadSample(context.host.fs, context.session.cwd, input.otherPath ?? "");
				const result = diffBytes(left.bytes, right.bytes, { maxHunks: Math.trunc(input.maxHunks ?? 40) });
				publishToolResult({
					toolId: "diff_binaries",
					kind: "diff",
					target: `${left.path} ↔ ${right.path}`,
					summary: result.identical
						? `Byte-identical: ${left.name} == ${right.name} (${result.leftSize} bytes)`
						: `${result.changedBytes} byte(s) differ between ${left.name} and ${right.name} (${result.hunks.length} hunk(s))`,
					payload: {
						left: { name: left.name, size: result.leftSize, path: left.path },
						right: { name: right.name, size: result.rightSize, path: right.path },
						identical: result.identical,
						changedBytes: result.changedBytes,
						hunks: result.hunks.length,
						truncated: result.truncated,
						topHunks: result.hunks.slice(0, 8).map(h => ({ offset: `0x${h.offset.toString(16)}`, length: h.length })),
					},
				});

				if (result.identical) {
					return [`# ${left.name} vs ${right.name}`, "", `Byte-identical: ${result.leftSize} bytes, same SHA-256 input length and no differing byte.`].join("\n");
				}

				const lines = [
					`# ${left.name} vs ${right.name}`,
					"",
					`${left.name}: ${result.leftSize} bytes · ${right.name}: ${result.rightSize} bytes`,
					`${result.changedBytes} byte(s) differ${result.sameSize ? "" : ` (sizes differ by ${Math.abs(result.leftSize - result.rightSize)} byte(s); the tail is extra)`}.`,
				];
				if (result.hunks.length > 0) {
					lines.push("", "| offset | length | left | right |", "| --- | --- | --- | --- |");
					for (const hunk of result.hunks) {
						lines.push(`| 0x${hunk.offset.toString(16)} | ${hunk.length} | \`${hunk.left}\` | \`${hunk.right}\` |`);
					}
					lines.push("", "Offsets and lengths are file offsets; each side shows at most 32 bytes of the hunk.");
				}
				if (result.truncated) lines.push("", "More hunks exist than the reporting budget; raise `maxHunks` or compare smaller regions.");
				lines.push("", "A changed byte is a fact, not a conclusion: say where the difference is and read that region before explaining it.");
				return lines.join("\n");
			} catch (error) {
				return `Binary diff failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}
