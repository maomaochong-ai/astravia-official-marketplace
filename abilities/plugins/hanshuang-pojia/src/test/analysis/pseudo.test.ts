import { describe, expect, it } from "vitest";
import { decompileFunction } from "../../domain/native/pseudo";

/** 把一组 32 位字按小端拼成字节流：伪代码引擎只吃字节，不吃汇编文本。 */
function words(...values: number[]): Uint8Array {
	const out = new Uint8Array(values.length * 4);
	const view = new DataView(out.buffer);
	values.forEach((value, index) => view.setUint32(index * 4, value >>> 0, true));
	return out;
}

const NOP = 0xd503201f;
const RET = 0xd65f03c0;
const movW0_1 = 0x52800020; // mov w0, #0x1
const cmpW0W8 = 0x6b08001f; // cmp w0, w8
const csetW0NE = 0x1a9f17e0; // cset w0, ne
const cbzW0 = 0x34000060; // cbz w0, +0xc
const bl = 0x94000004; // bl +0x10

describe("pseudo-C recovery", () => {
	it("renders register moves, comparisons and flag landings", () => {
		const bytes = words(movW0_1, cmpW0W8, csetW0NE, RET);
		const result = decompileFunction(bytes, "aarch64", { start: 0, end: bytes.byteLength });
		expect(result.text).toContain("w0 = 0x1;");
		expect(result.text).toContain("/* cmp w0, w8 */");
		// cset 紧跟在比较后面时写成三元表达式，而不是留下一个没人读的 flag_ne。
		expect(result.text).toContain("w0 = (w0 != w8) ? 1 : 0;");
		expect(result.text).toContain("return;");
	});

	it("turns a conditional branch into an if with the compared operands", () => {
		const bytes = words(cmpW0W8, 0x54000060 | 0x1, NOP, RET);
		const result = decompileFunction(bytes, "aarch64", { start: 0, end: bytes.byteLength });
		expect(result.text).toMatch(/if \(w0 != w8\) goto L_[0-9a-f]+;/);
	});

	it("falls back to flag names when the comparison is out of range", () => {
		const bytes = words(cbzW0, 0x54000041, RET);
		const result = decompileFunction(bytes, "aarch64", { start: 0, end: bytes.byteLength });
		// cbz 自带操作数，所以条件不依赖前面比较；b.ne 在没有 cmp 时只能写旗标。
		expect(result.text).toContain("if (w0 == 0) goto");
		expect(result.text).toContain("flags_ne");
	});

	it("marks calls with the resolved symbol name", () => {
		const bytes = words(bl, RET);
		const names = new Map([[0x10, "check_license"]]);
		const result = decompileFunction(bytes, "aarch64", { start: 0, end: bytes.byteLength, names });
		expect(result.text).toContain("check_license();");
		expect(result.calls).toBe(1);
	});

	it("keeps comparisons visible in fold mode and drops them in summary mode", () => {
		const bytes = words(movW0_1, cmpW0W8, 0x54000061, RET);
		const full = decompileFunction(bytes, "aarch64", { start: 0, end: bytes.byteLength, mode: "full" }).text;
		const fold = decompileFunction(bytes, "aarch64", { start: 0, end: bytes.byteLength, mode: "fold" }).text;
		const summary = decompileFunction(bytes, "aarch64", { start: 0, end: bytes.byteLength, mode: "summary" }).text;
		expect(full).toContain("if (w0 != w8) goto");
		// fold 保留控制流但把比较压成注释；summary 连注释都省掉，只留骨架。
		expect(fold).toContain("/* cmp w0, w8 */");
		expect(fold).toContain("goto");
		expect(summary).not.toContain("cmp");
		expect(summary).toContain("goto");
	});

	it("stops at the character budget and says so", () => {
		const filler = new Array(400).fill(movW0_1);
		const bytes = words(...filler, RET);
		const result = decompileFunction(bytes, "aarch64", { start: 0, end: bytes.byteLength, budget: 800, maxInstructions: 400 });
		expect(result.truncated).toBe(true);
		expect(result.budget).toBe(800);
		expect(result.text.length).toBeLessThanOrEqual(800 + 200);
		expect(result.text).toMatch(/truncat/i);
	});

	it("keeps undecodable words visible instead of inventing instructions", () => {
		const bytes = words(0x00000000, RET);
		const result = decompileFunction(bytes, "aarch64", { start: 0, end: bytes.byteLength });
		expect(result.text).toContain("/* .word 0x00000000 */");
	});

	it("names stack slots by displacement instead of inventing variables", () => {
		// str w0, [sp, #8]：栈槽按偏移命名，不做变量合并 —— 这是能力边界，不是缺陷。
		const bytes = words(0xb9000be0, RET);
		const result = decompileFunction(bytes, "aarch64", { start: 0, end: bytes.byteLength });
		expect(result.text).toContain("var_8 = w0;");
	});
});
