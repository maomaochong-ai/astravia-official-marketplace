// 字节级差分：相同区间折叠成 hunk，差异区间给出两侧字节。
// 目标形态是「一处补丁显示成一两个 hunk」，不能被等长噪声淹没。

import { describe, expect, it } from "vitest";
import { diffBytes } from "../../domain/diff";

function bytes(values: readonly number[]): Uint8Array {
	return new Uint8Array(values);
}

describe("binary diff", () => {
	it("detects identical input", () => {
		const result = diffBytes(bytes([1, 2, 3]), bytes([1, 2, 3]));
		expect(result.identical).toBe(true);
		expect(result.changedBytes).toBe(0);
		expect(result.hunks).toEqual([]);
	});

	it("reports one hunk for one patched byte", () => {
		const result = diffBytes(bytes([0x55, 0x48, 0x31, 0xc0, 0xc3]), bytes([0x55, 0x48, 0x31, 0xff, 0xc3]));
		expect(result.identical).toBe(false);
		expect(result.sameSize).toBe(true);
		expect(result.changedBytes).toBe(1);
		expect(result.hunks).toHaveLength(1);
		expect(result.hunks[0]!.offset).toBe(3);
		expect(result.hunks[0]!.left).toBe("c0");
		expect(result.hunks[0]!.right).toBe("ff");
	});

	it("merges nearby differences and splits distant ones", () => {
		const left = new Uint8Array(64);
		const right = new Uint8Array(64);
		right[1] = 0xaa;
		right[4] = 0xbb;
		right[40] = 0xcc;
		const result = diffBytes(left, right);
		expect(result.changedBytes).toBe(3);
		expect(result.hunks).toHaveLength(2);
		expect(result.hunks[0]!.offset).toBe(1);
		expect(result.hunks[1]!.offset).toBe(40);
	});

	it("counts the size difference instead of hiding it in a hunk", () => {
		const result = diffBytes(bytes([1, 2, 3]), bytes([1, 2, 3, 4, 5]));
		expect(result.sameSize).toBe(false);
		expect(result.changedBytes).toBe(2);
		expect(result.hunks).toEqual([]);
	});

	it("truncates the hunk list at the budget", () => {
		const left = new Uint8Array(200);
		const right = new Uint8Array(200);
		for (let index = 0; index < 200; index += 20) right[index] = 0xff;
		const result = diffBytes(left, right, { maxHunks: 3 });
		expect(result.hunks).toHaveLength(3);
		expect(result.truncated).toBe(true);
		expect(result.changedBytes).toBe(10);
	});

	it("caps the hex shown per hunk", () => {
		const left = new Uint8Array(80);
		const right = new Uint8Array(80).fill(0xff);
		const result = diffBytes(left, right);
		expect(result.hunks[0]!.left).toContain("more)");
	});
});
