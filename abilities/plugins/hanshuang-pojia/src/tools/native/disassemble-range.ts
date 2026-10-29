/**
 * `disassemble_range`：对一段有界区间做线性扫描反汇编。
 *
 * AArch64 按固定 4 字节编码解码；x86 / x86-64 只覆盖一个实用子集，子集外的字节输出成
 * `.byte` / `.word` 占位——这样一处未知编码不会把后面的列全部错位。
 * 地址是文件偏移，跳转目标写成 `file+0x…`，偏移与虚拟地址的换算不在这里做。
 */
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { readNativeFacts } from "../../domain/native/detect";
import { disassemble } from "../../domain/native/disasm";
import { loadSample } from "../lib/read-sample";
import { publishToolResult } from "../../runtime/panel-channel";

interface DisassembleRangeInput {
	path?: string;
	offset?: number;
	length?: number;
	maxInstructions?: number;
	arch?: string;
}

const MAX_BYTES = 8192;
const MAX_INSTRUCTIONS = 512;

export function registerDisassembleRangeTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<DisassembleRangeInput>({
		id: "disassemble_range",
		name: "disassemble_range",
		label: "%tool.disasm.label%",
		description: [
			"Linear-sweep disassemble a bounded byte range of an ELF / PE / Mach-O image and return the",
			"listing as a table. AArch64 is decoded from its fixed 4-byte encoding; x86 and x86-64 use a",
			"practical instruction subset (branches, calls, mov/lea, add/sub/and/or/xor/cmp/test, push/pop,",
			"syscall, movzx/movsx). Anything outside that subset is emitted as `.byte` / `.word`, so an",
			"unknown encoding never desynchronises the rest of the listing.",
			"",
			"Addresses are file offsets and branch targets are printed as `file+0x…`. That is exact for",
			"following code inside the file, but it is not a virtual address and it is not a function",
			"boundary: this is not a control-flow-aware disassembler and it does not produce pseudo-C.",
			"",
			"Use it to read a stub, a prologue, a decryption loop or the callee list around an address that",
			"another tool already pointed at (a string xref, an export, an entry point). Pick `offset` from",
			"a section or symbol address you already know; do not sweep a whole multi-megabyte image.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "File path, absolute or relative to the session working directory." },
				offset: { type: "integer", description: "File offset to start at (default 0)." },
				length: { type: "integer", description: `Bytes to walk (default 256, max ${MAX_BYTES}).` },
				maxInstructions: { type: "integer", description: `Instruction budget (default 96, max ${MAX_INSTRUCTIONS}).` },
				arch: {
					type: "string",
					description: "Override the detected architecture, e.g. aarch64 or x86-64. Needed when the image does not describe its machine.",
				},
			},
			required: ["path"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 120_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const sample = await loadSample(context.host.fs, context.session.cwd, input.path ?? "");
				const parsed = readNativeFacts(sample.bytes);
				const arch = (input.arch ?? "").trim() || parsed?.value?.arch || "";
				if (arch === "") {
					return `${sample.name} is not an ELF, PE or Mach-O image, so its machine type is unknown. Pass \`arch\` explicitly (aarch64 or x86-64) if you know what the bytes are.`;
				}
				const offset = Math.max(0, Math.min(sample.bytes.byteLength, Math.trunc(input.offset ?? 0)));
				const length = Math.max(4, Math.min(MAX_BYTES, Math.trunc(input.length ?? 256)));
				const max = Math.max(1, Math.min(MAX_INSTRUCTIONS, Math.trunc(input.maxInstructions ?? 96)));
				const result = disassemble(sample.bytes, arch, { offset, length, max });
				publishToolResult({
					toolId: "disassemble_range",
					kind: "disasm",
					target: sample.path,
					summary: `${result.instructions.length} instruction(s) at 0x${offset.toString(16)} (${result.arch}) in ${sample.name}`,
					payload: {
						name: sample.name,
						arch: result.arch,
						offset: `0x${offset.toString(16)}`,
						length,
						truncated: result.truncated,
						instructions: result.instructions.slice(0, 60).map(i => ({ offset: `0x${i.offset.toString(16)}`, text: i.text })),
						count: result.instructions.length,
					},
				});
				if (result.instructions.length === 0) {
					return `No instruction decoded in ${sample.name} at 0x${offset.toString(16)}. ${result.warnings.join(" ")}`;
				}

				const lines = [
					`# Disassembly of ${sample.name}`,
					"",
					`${result.arch} · file offsets 0x${offset.toString(16)}–0x${(offset + length).toString(16)} · ${result.instructions.length} instruction(s)`,
					"",
					"| offset | bytes | instruction |",
					"| --- | --- | --- |",
				];
				for (const instruction of result.instructions) {
					lines.push(`| 0x${instruction.offset.toString(16)} | \`${instruction.hex}\` | \`${instruction.text.replace(/\|/g, "\\|")}\` |`);
				}

				const calls = new Set<string>();
				for (const instruction of result.instructions) {
					const match = /^(?:call|bl|blr|jmp) (file\+0x[0-9a-f]+|x\d+|rax|rcx|rdx|rbx|rsp|rbp|rsi|rdi|r\d+)$/.exec(instruction.text);
					if (match) calls.add(match[1]!);
				}
				if (calls.size > 0) lines.push("", `Direct branch targets: ${[...calls].map(target => `\`${target}\``).join(", ")}.`);

				if (result.truncated) lines.push("", "The range was longer than the instruction budget, so the listing stops early. Narrow `length` or raise `maxInstructions`.");
				if (result.warnings.length > 0) lines.push("", ...result.warnings.map(warning => `- ${warning}`));
				lines.push(
					"",
					"Linear sweep with a bounded decoder: `.byte` / `.word` rows mean 'not decoded', not 'invalid code'. Branch targets are file offsets, and this listing proves nothing about reachability.",
				);
				return lines.join("\n");
			} catch (error) {
				return `Disassembly failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}
