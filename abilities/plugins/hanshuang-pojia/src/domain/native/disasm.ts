/**
 * Bounded linear sweep disassembly for the two architectures that show up in
 * the samples this plugin triages. It is deliberately not a decompiler and not
 * a control-flow-aware disassembler: it walks a byte range once, decodes the
 * instruction forms it knows, and emits `.byte` / `.word` for the rest so that
 * an unknown encoding never desynchronises the rest of the listing.
 *
 * Addresses are file offsets. Branch targets are therefore printed as
 * `file+0x…`, which is exact for following code in the file but is not a
 * virtual address.
 *
 * The decoding itself lives in `insn.ts`, which also reports each instruction's
 * flow kind and data references. This module is the flat-listing shape on top of
 * it, and its text output is a stable contract: the tests pin exact strings.
 */

import { decodeRange, disasmArchFor } from "./insn";
import type { DisasmArch } from "./insn";

export { disasmArchFor };
export type { DisasmArch };

export interface Instruction {
	offset: number;
	hex: string;
	text: string;
}

export interface DisasmResult {
	arch: DisasmArch;
	instructions: Instruction[];
	truncated: boolean;
	warnings: string[];
}

const MAX_INSTRUCTIONS = 4096;

export function disassemble(
	bytes: Uint8Array,
	archArgument: string,
	options: { offset?: number; length?: number; max?: number } = {},
): DisasmResult {
	const arch = disasmArchFor(archArgument);
	const start = Math.max(0, Math.min(bytes.byteLength, options.offset ?? 0));
	const length = Math.max(0, Math.min(bytes.byteLength - start, options.length ?? 256));
	const max = Math.max(1, Math.min(MAX_INSTRUCTIONS, options.max ?? 512));
	const end = start + length;

	if (arch === "unknown" || arch === "arm") {
		return {
			arch,
			instructions: [],
			truncated: false,
			warnings: [`no linear-sweep decoder for ${archArgument}; use an external disassembler for this architecture`],
		};
	}

	const run = decodeRange(bytes, arch, start, end, max);
	return {
		arch,
		instructions: run.instructions.map(instruction => ({ offset: instruction.offset, hex: instruction.hex, text: instruction.text })),
		truncated: run.truncated,
		warnings: run.warnings,
	};
}
