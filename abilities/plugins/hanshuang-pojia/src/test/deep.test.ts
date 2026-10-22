import { describe, expect, it } from "vitest";
import { buildFunctionView, isControlRelevant } from "../domain/native/cfg";
import { deepAnalyse, functionBoundFor, listFunctionCandidates, peekCString } from "../domain/native/deep";
import { decodeAt, decodeRange } from "../domain/native/insn";
import { addressMapFor } from "../domain/native/image";
import type { NativeFacts } from "../domain/native/types";
import { buildXrefIndex, candidateStarts, callersOf } from "../domain/native/xref";

function words(...values: number[]): Uint8Array {
	const out = new Uint8Array(values.length * 4);
	const view = new DataView(out.buffer);
	values.forEach((value, index) => view.setUint32(index * 4, value >>> 0, true));
	return out;
}

// bl 到相对偏移：目标 = 当前地址 + imm26*4
function bl(delta: number): number {
	return (0x94000000 | ((delta >> 2) & 0x03ffffff)) >>> 0;
}

describe("structured decoding", () => {
	it("classifies control flow and resolves branch targets", () => {
		const bytes = words(0x94000004, 0xd65f03c0, 0x14000002, 0xd61f0000);
		const call = decodeAt(bytes, "aarch64", 0);
		const ret = decodeAt(bytes, "aarch64", 4);
		const jump = decodeAt(bytes, "aarch64", 8);
		const indirect = decodeAt(bytes, "aarch64", 12);

		expect(call?.flow).toEqual({ kind: "call", target: 0x10 });
		expect(ret?.flow).toEqual({ kind: "ret" });
		expect(jump?.flow).toEqual({ kind: "jump", target: 0x10 });
		expect(indirect?.flow).toEqual({ kind: "indirect" });
	});

	it("keeps condition mnemonics available for structured filtering", () => {
		// cond 字段 = 1 才是 ne；0 是 eq。
		const bytes = words(0xb4000080, 0x54ffffe1);
		const cbz = decodeAt(bytes, "aarch64", 0);
		const branch = decodeAt(bytes, "aarch64", 4);
		expect(cbz?.flow.kind).toBe("cond");
		expect(branch?.flow.condition).toBe("ne");
		expect(isControlRelevant(cbz!)).toBe(true);
	});

	it("reports data references from rip-relative addressing", () => {
		// 48 8d 3d 10 00 00 00 = lea rdi, [rip + 0x10]
		const bytes = new Uint8Array([0x48, 0x8d, 0x3d, 0x10, 0x00, 0x00, 0x00]);
		const insn = decodeAt(bytes, "x86-64", 0);
		expect(insn?.refs).toEqual([0x17]);
	});

	it("stops a range when aarch64 is left with a partial instruction", () => {
		const bytes = words(0xd65f03c0).subarray(0, 6);
		const run = decodeRange(bytes, "aarch64", 0, 6, 16);
		expect(run.instructions).toHaveLength(1);
		expect(run.truncated).toBe(true);
		expect(run.warnings.join(" ")).toMatch(/trailing 2 byte/);
	});
});

describe("function views", () => {
	it("splits basic blocks at branches and records successors", () => {
		// cmp w0,#0 ; b.eq +8 ; ret ; ret
		const bytes = words(0x7100001f, 0x54000040, 0xd65f03c0, 0xd65f03c0);
		const view = buildFunctionView(bytes, "aarch64", { start: 0, end: 16 });
		expect(view.blocks.map(block => block.start)).toEqual([0, 8, 12]);
		expect(view.blocks[0]?.successors).toEqual([
			{ to: 12, kind: "taken" },
			{ to: 8, kind: "fallthrough" },
		]);
		expect(view.stats.blocks).toBe(3);
		expect(view.stats.stackFrame).toBeNull();
	});

	it("estimates the stack frame from the prologue only", () => {
		// stp x29,x30,[sp,#-0x20]! ; mov x29,sp ; sub sp,sp,#0x40 ; bl ... ; ret
		const bytes = words(0xa9be7bfd, 0x910003fd, 0xd10103ff, 0xd65f03c0);
		const view = buildFunctionView(bytes, "aarch64", { start: 0, end: 16 });
		expect(view.stats.stackFrame).toBe(0x60);
	});

	it("stops at padding after a terminator instead of swallowing the next function", () => {
		const code = words(0xd65f03c0);
		const bytes = new Uint8Array(64);
		bytes.set(code, 0);
		const view = buildFunctionView(bytes, "aarch64", { start: 0, end: 64 });
		expect(view.end).toBe(4);
		expect(view.truncated).toBe(false);
	});
});

describe("cross-reference index", () => {
	it("records callers per target and discovers function starts", () => {
		// 0x00 bl 0x10 ; 0x04 ret ; 0x08 bl 0x10 ; 0x0c ret ; 0x10 ret
		const bytes = new Uint8Array(32);
		const view = new DataView(bytes.buffer);
		view.setUint32(0, bl(0x10), true);
		view.setUint32(4, 0xd65f03c0, true);
		view.setUint32(8, bl(0x08), true);
		view.setUint32(12, 0xd65f03c0, true);
		view.setUint32(16, 0xd65f03c0, true);

		const index = buildXrefIndex(bytes, "aarch64", [{ start: 0, end: 20 }]);
		expect(callersOf(index, 0x10)).toEqual([0, 8]);
		expect(index.discovered.has(0x10)).toBe(true);
		expect(candidateStarts(index, [0]).slice(0, 2)).toEqual([0, 0x10]);
		expect(index.truncated).toBe(false);
	});

	it("flags truncation when the instruction budget runs out", () => {
		const bytes = new Uint8Array(64);
		for (let offset = 0; offset < 64; offset += 4) new DataView(bytes.buffer).setUint32(offset, 0xd503201f, true);
		const index = buildXrefIndex(bytes, "aarch64", [{ start: 0, end: 64 }], { maxInstructions: 4 });
		expect(index.truncated).toBe(true);
		expect(index.scanned).toBe(4);
	});
});

function syntheticFacts(): NativeFacts {
	return {
		format: "elf",
		arch: "x86-64",
		bits: 64,
		endianness: "little",
		kind: "ET_DYN",
		entryPoint: 0x1000,
		entryOffset: 0,
		pie: true,
		executableStack: false,
		nxCompat: true,
		signed: false,
		stripped: true,
		dotnet: false,
		interpreter: null,
		sections: [{ name: ".text", size: 64, entropy: 4, executable: true, writable: false, offset: 0, vaddr: 0x1000 }],
		imports: [],
		libraries: [],
		notes: [],
	};
}

describe("deep analysis", () => {
	it("returns the three output tiers with different shapes", () => {
		// stp ; mov x29,sp ; bl 0x20 ; cbz w0,+8 ; ret ; nop ; ret
		const bytes = new Uint8Array(64);
		const view = new DataView(bytes.buffer);
		view.setUint32(0, 0xa9bf7bfd, true);
		view.setUint32(4, 0x910003fd, true);
		view.setUint32(8, bl(0x18), true);
		view.setUint32(12, 0xb4000040, true);
		view.setUint32(16, 0xd65f03c0, true);
		view.setUint32(20, 0xd503201f, true);
		view.setUint32(24, 0xd65f03c0, true);

		const index = buildXrefIndex(bytes, "aarch64", [{ start: 0, end: 28 }]);
		const full = deepAnalyse(bytes, "aarch64", { start: 0, end: 28 }, { mode: "full", index });
		const branch = deepAnalyse(bytes, "aarch64", { start: 0, end: 28 }, { mode: "branch", index });
		const summary = deepAnalyse(bytes, "aarch64", { start: 0, end: 28 }, { mode: "summary", index });

		expect(full.text.split("\n")[0]).toBe("; function @ 0x0");
		expect(full.instructions).toBe(7);
		expect(full.blocks).toBe(3);
		expect(full.calls).toBe(1);
		expect(full.text).toContain("bl file+0x20");
		expect(full.text).toContain("; block 0x0 → 0x14, 0x10");

		expect(branch.text).not.toContain("stp x29, x30");
		expect(branch.text).toContain("cbz");
		expect(branch.text).toMatch(/filtered \d+ of 7 lines/);

		expect(summary.text).not.toContain("stp x29, x30");
		expect(summary.text).toContain("; callees (1)");
		expect(summary.text).toContain("  0x20");
	});

	it("truncates on the character budget and says so", () => {
		const bytes = new Uint8Array(512);
		for (let offset = 0; offset < 512; offset += 4) new DataView(bytes.buffer).setUint32(offset, 0xd503201f, true);
		const result = deepAnalyse(bytes, "aarch64", { start: 0, end: 512 }, { mode: "full", budget: 500 });
		expect(result.truncated).toBe(true);
		expect(result.text).toContain("[TRUNCATED at 500 chars");
		expect(result.budget).toBe(500);
	});

	it("reads printable C strings and rejects binary noise", () => {
		const bytes = new Uint8Array([0x2f, 0x74, 0x6d, 0x70, 0x2f, 0x78, 0x00, 0x01, 0x02, 0x03, 0x04]);
		expect(peekCString(bytes, 0)).toBe("/tmp/x");
		expect(peekCString(bytes, 7)).toBeNull();
		expect(peekCString(bytes, 0x40)).toBeNull();
	});

	it("lists the entry point first and derives a bound from neighbours", () => {
		const bytes = new Uint8Array(64);
		const facts = syntheticFacts();
		const map = addressMapFor(facts);
		const candidates = listFunctionCandidates(bytes, facts, [], map);
		expect(candidates[0]).toEqual({ offset: 0, name: "entry", source: "entry" });
		expect(functionBoundFor(0, candidates, map)).toBe(64);
		expect(functionBoundFor(0, [{ offset: 0, name: null, source: "entry" }, { offset: 32, name: null, source: "call" }], map)).toBe(32);
	});
});
