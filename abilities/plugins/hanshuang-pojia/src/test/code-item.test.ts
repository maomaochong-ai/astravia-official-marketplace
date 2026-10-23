import { describe, expect, it } from "vitest";
import { readCodeItem } from "../domain/android/code-item";

/** 构造一段最小 code_item：registers=2, ins=1, insns=3 条指令（move, const/4, return）。 */
function buildMinimalDexWithCodeItem(): Uint8Array {
	// 1. 最小 DEX 头（0x70）+ 各 id 表空
	const header = new Uint8Array(0x70);
	new DataView(header.buffer).setUint32(40, 0x12345678, true);
	// 2. code_item：5×u32 头 + 3 条指令
	// insns: [move v0,v1]=0x01 0x01 0x00 | [const/4 v0,#1]=0x12 0x01 | [return-void]=0x0e 0x00
	const insns = new Uint16Array([0x1001, 0x1012, 0x000e]);
	const insnsBytes = new Uint8Array(insns.buffer);
	// code_item 头：registers=2 ins=1 outs=0 tries=0 debug=0 insnsSize=3（u32）
	const headerLen = 16;
	const codeItem = new Uint8Array(headerLen + insnsBytes.byteLength);
	const view = new DataView(codeItem.buffer);
	view.setUint16(0, 2, true);
	view.setUint16(2, 1, true);
	view.setUint16(4, 0, true);
	view.setUint16(6, 0, true);
	view.setUint32(8, 0, true);
	view.setUint32(12, 3, true);
	codeItem.set(insnsBytes, headerLen);
	return concat([header, codeItem]);
}

function concat(parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.byteLength;
	}
	return out;
}

describe("code_item reader", () => {
	it("reads the registers / ins / outs frame of a method's code_item", () => {
		const bytes = buildMinimalDexWithCodeItem();
		const codeOff = 0x70;
		const code = readCodeItem(bytes, codeOff);
		expect(code.registersSize).toBe(2);
		expect(code.insSize).toBe(1);
		expect(code.outsSize).toBe(0);
		expect(code.triesSize).toBe(0);
		expect(code.insnsSize).toBe(3);
		expect(code.instructions).toHaveLength(3);
	});

	it("decodes move, const/4 and return-void instructions", () => {
		const bytes = buildMinimalDexWithCodeItem();
		const code = readCodeItem(bytes, 0x70);
		expect(code.instructions[0]!.op).toBe("move");
		expect(code.instructions[0]!.operands).toContain("v0");
		expect(code.instructions[0]!.operands).toContain("v1");
		expect(code.instructions[1]!.op).toBe("const/4");
		expect(code.instructions[2]!.op).toBe("return-void");
		// 每条指令都推进了游标
		const offsets = code.instructions.map(insn => insn.offset);
		expect(offsets).toEqual([0, 1, 2]);
	});

	it("notes an absent code offset as empty", () => {
		const code = readCodeItem(new Uint8Array(0x80), 0);
		expect(code.instructions).toHaveLength(0);
		expect(code.notes.some(n => n.includes("no code_item"))).toBe(true);
	});

	it("truncates long bodies to the instruction budget and says so", () => {
		const bytes = buildMinimalDexWithCodeItem();
		const code = readCodeItem(bytes, 0x70, 2);
		expect(code.instructions).toHaveLength(2);
		expect(code.notes.some(n => n.includes("truncated"))).toBe(true);
	});
});