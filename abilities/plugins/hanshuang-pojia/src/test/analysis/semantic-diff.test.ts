import { describe, expect, it } from "vitest";
import {
	compareFunctionSets,
	fingerprintFunctions,
	renderSemanticDiff,
	shapeOfInstruction,
	semanticDiff,
} from "../../domain/native/semantic-diff";
import type { FunctionEntry, FunctionSet } from "../../domain/native/semantic-diff";
import type { DisasmArch } from "../../domain/native/insn";
import { buildElfWithAddressedText, buildElfWithSymbols } from "../fixtures";

function entry(name: string, start: number, overrides: Partial<FunctionEntry> = {}): FunctionEntry {
	return {
		start,
		name,
		size: 16,
		instructions: 4,
		calls: 0,
		exact: `exact-${name}`,
		shape: "shape-shared",
		callees: [],
		...overrides,
	};
}

function setOf(arch: DisasmArch, functions: FunctionEntry[]): FunctionSet {
	return { arch, functions, warnings: [] };
}

describe("instruction shapes", () => {
	it("keeps the mnemonic and erases operands", () => {
		expect(shapeOfInstruction("mov w8, #0x1337")).toBe(shapeOfInstruction("mov w9, #0x42"));
		expect(shapeOfInstruction("mov w8, #0x1337")).not.toBe(shapeOfInstruction("mov w8, w9"));
	});

	it("treats registers and immediates as different kinds of operand", () => {
		expect(shapeOfInstruction("cmp w0, w1")).toBe("cmp r32 r32");
		expect(shapeOfInstruction("cmp w0, #0x1")).toBe("cmp r32 #");
	});

	it("keeps the register width in the shape", () => {
		// 32 位与 64 位寄存器混为一谈，就会把溢出回归误报成「只改了常量」。
		expect(shapeOfInstruction("mov w0, #1")).toBe("mov r32 #");
		expect(shapeOfInstruction("mov x0, #1")).toBe("mov r64 #");
		expect(shapeOfInstruction("mov w0, #1")).not.toBe(shapeOfInstruction("mov x0, #1"));
	});

	it("keeps operand positions distinct", () => {
		expect(shapeOfInstruction("cmp w0, w1")).not.toBe(shapeOfInstruction("cmp w0, #0x1"));
	});
});

describe("function matching", () => {
	it("matches by symbol name and reports identical bytes as same", () => {
		const diff = compareFunctionSets(setOf("aarch64", [entry("gate", 0x10)]), setOf("aarch64", [entry("gate", 0x20)]));
		expect(diff.matches).toHaveLength(1);
		expect(diff.matches[0]!.status).toBe("same");
		expect(diff.identical).toBe(true);
	});

	it("separates a changed constant from a changed shape", () => {
		const left = setOf("aarch64", [entry("gate", 0x10)]);
		const right = setOf("aarch64", [entry("gate", 0x10, { exact: "other-exact" })]);
		expect(compareFunctionSets(left, right).matches[0]!.status).toBe("constants-only");

		const shapeChanged = setOf("aarch64", [entry("gate", 0x10, { exact: "other-exact", shape: "other-shape" })]);
		expect(compareFunctionSets(left, shapeChanged).matches[0]!.status).toBe("changed");
	});

	it("falls back to a shape match when the symbol was renamed", () => {
		const left = setOf("aarch64", [entry("old_name", 0x10)]);
		const right = setOf("aarch64", [entry("new_name", 0x40)]);
		const diff = compareFunctionSets(left, right);
		expect(diff.matches).toHaveLength(1);
		expect(diff.matches[0]!.status).toBe("renamed");
		expect(diff.matches[0]!.name).toBe("old_name → new_name");
		expect(diff.added).toHaveLength(0);
		expect(diff.removed).toHaveLength(0);
	});

	it("lists functions that only exist on one side", () => {
		// 形状也不同，才真的只有一侧存在；形状相同会被第二轮当成重命名。
		const left = setOf("aarch64", [entry("only_left", 0x10, { shape: "left-shape" })]);
		const right = setOf("aarch64", [entry("only_right", 0x20, { shape: "right-shape" })]);
		const diff = compareFunctionSets(left, right);
		expect(diff.matches).toHaveLength(0);
		expect(diff.removed.map(item => item.name)).toEqual(["only_left"]);
		expect(diff.added.map(item => item.name)).toEqual(["only_right"]);
		expect(diff.identical).toBe(false);
	});

	it("refuses to compare across architectures", () => {
		const diff = compareFunctionSets(setOf("aarch64", []), setOf("x86-64", []));
		expect(diff.arch).toBeNull();
		expect(diff.archMismatch).toContain("aarch64");
		const rendered = renderSemanticDiff(diff);
		expect(rendered).toContain("Architecture mismatch");
	});
});

describe("fingerprinting a real image", () => {
	// mov eax, #1 / ret / mov eax, #2 / ret
	const code = new Uint8Array([0xb8, 0x01, 0x00, 0x00, 0x00, 0xc3, 0xb8, 0x02, 0x00, 0x00, 0x00, 0xc3]);
	const image = (bytes = code) => buildElfWithAddressedText(bytes, [{ name: "gate", offset: 0 }, { name: "helper", offset: 8 }]);

	it("reads functions out of a synthetic ELF", () => {
		const set = fingerprintFunctions(image());
		expect(set.arch).toBe("x86-64");
		expect(set.functions.map(fn => fn.name)).toEqual(["gate", "helper"]);
		for (const fn of set.functions) {
			// 指纹必须是稳定值：同一份字节跑两次得到同一个 hash，否则 diff 全是噪声。
			expect(fn.exact).toMatch(/^[0-9a-f]{64}$/);
			expect(fn.shape).toMatch(/^[0-9a-f]{64}$/);
		}
	});

	it("reports the same image as identical to itself", () => {
		const bytes = image();
		const diff = semanticDiff(bytes, bytes);
		expect(diff.identical).toBe(true);
		expect(diff.matches.every(match => match.status === "same")).toBe(true);
	});

	it("calls a changed immediate constants-only and a changed instruction changed", () => {
		const constantPatched = image(new Uint8Array([0xb8, 0x07, 0x00, 0x00, 0x00, 0xc3, 0xb8, 0x02, 0x00, 0x00, 0x00, 0xc3]));
		const constantsOnly = semanticDiff(image(), constantPatched);
		expect(constantsOnly.identical).toBe(false);
		expect(constantsOnly.matches.find(match => match.name === "gate")?.status).toBe("constants-only");

		// 换成 xor eax, eax 再 ret：助记符变了，形状就变了。
		const shapePatched = image(new Uint8Array([0x31, 0xc0, 0xc3, 0x90, 0x90, 0x90, 0xb8, 0x02, 0x00, 0x00, 0x00, 0xc3]));
		const changed = semanticDiff(image(), shapePatched);
		expect(changed.matches.find(match => match.name === "gate")?.status).toBe("changed");
	});

	it("refuses to call two unanalysable images identical", () => {
		// buildElfWithSymbols 的符号地址落不进 .text，两侧都取不到函数 —— 这时「相同」是无证据的结论。
		const diff = semanticDiff(buildElfWithSymbols(), buildElfWithSymbols());
		expect(diff.matches).toHaveLength(0);
		expect(diff.identical).toBe(false);
		expect(renderSemanticDiff(diff)).toContain("No functions could be fingerprinted");
	});

	it("explains that a shape match is evidence, not a conclusion", () => {
		const rendered = renderSemanticDiff(compareFunctionSets(setOf("aarch64", []), setOf("aarch64", [])));
		expect(rendered).toContain("evidence, not proof");
	});
});
