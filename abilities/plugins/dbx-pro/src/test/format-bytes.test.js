/**
 * format-bytes 纯逻辑测试 —— 下载后台「大小」列的边界与单位换算。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatBytes } from "../features/database-workspace/services/format-bytes.ts";

describe("formatBytes", () => {
	it("未知大小显示占位符，不显示 0", () => {
		assert.equal(formatBytes(undefined), "—");
		assert.equal(formatBytes(null), "—");
		assert.equal(formatBytes(Number.NaN), "—");
		assert.equal(formatBytes(-1), "—");
	});

	it("1000 字节以内按 B 显示，不参与换算", () => {
		assert.equal(formatBytes(0), "0 B");
		assert.equal(formatBytes(1), "1 B");
		assert.equal(formatBytes(999), "999 B");
	});

	it("十进制进位：KB / MB / GB", () => {
		assert.equal(formatBytes(1000), "1.0 KB");
		assert.equal(formatBytes(1234), "1.2 KB");
		assert.equal(formatBytes(42_100_000), "42.1 MB");
		assert.equal(formatBytes(61_800_000), "61.8 MB");
		assert.equal(formatBytes(2_500_000_000), "2.5 GB");
	});

	it("最大单位封顶，不越界", () => {
		assert.equal(formatBytes(5_000_000_000_000), "5.0 TB");
		assert.equal(formatBytes(9_000_000_000_000_000), "9000.0 TB");
	});
});
