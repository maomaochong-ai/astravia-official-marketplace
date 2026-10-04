/**
 * protocol 层单测 — 错误码映射、EngineError 标记、错误归一与 JSON 安全化。
 * 全部纯函数，不依赖引擎二进制。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ENGINE_VERSION,
	MAX_BODY_BYTES,
	engineError,
	fail,
	httpStatusForCode,
	isEngineError,
	jsonReplacer,
	normalizeThrown,
	ok,
	stringifyJson,
} from "../src/engine/protocol.mjs";

describe("protocol 常量", () => {
	it("ENGINE_VERSION 是 semver 字符串", () => {
		assert.match(ENGINE_VERSION, /^\d+\.\d+\.\d+$/);
	});
	it("请求体上限为正整数", () => {
		assert.ok(MAX_BODY_BYTES > 0);
	});
});

describe("httpStatusForCode", () => {
	const expected = {
		BAD_REQUEST: 400,
		UNAUTHORIZED: 401,
		NOT_FOUND: 404,
		METHOD_NOT_ALLOWED: 405,
		PAYLOAD_TOO_LARGE: 413,
		WRITE_BLOCKED: 403,
		CONFIRM_MISMATCH: 403,
		WRITE_UNSUPPORTED: 501,
		DRIVER_ERROR: 502,
		CONNECTION_ERROR: 502,
		DBX_MCP_ERROR: 502,
		TIMEOUT: 504,
		INTERNAL: 500,
	};
	for (const [code, status] of Object.entries(expected)) {
		it(`${code} → ${status}`, () => assert.equal(httpStatusForCode(code), status));
	}
	it("未登记错误码一律 500", () => {
		assert.equal(httpStatusForCode("SOMETHING_NEW"), 500);
		assert.equal(httpStatusForCode(undefined), 500);
	});
});

describe("engineError / isEngineError", () => {
	it("EngineError 带鸭子类型标记，不能靠 instanceof 跨 bundle 判定", () => {
		const error = engineError("BAD_REQUEST", "坏请求", "detail-text");
		assert.equal(error.name, "EngineError");
		assert.equal(error.code, "BAD_REQUEST");
		assert.equal(error.message, "坏请求");
		assert.equal(error.detail, "detail-text");
		assert.equal(error.engineError, true);
		assert.equal(error instanceof Error, true);
		assert.equal(isEngineError(error), true);
	});

	it("非引擎错误不被误判", () => {
		assert.equal(isEngineError(null), false);
		assert.equal(isEngineError({}), false);
		assert.equal(isEngineError(new Error("x")), false);
		assert.equal(isEngineError({ engineError: true }), false); // 缺 code
		assert.equal(isEngineError({ engineError: true, code: 42 }), false); // code 非字符串
	});
});

describe("normalizeThrown", () => {
	it("EngineError 原样返回", () => {
		const error = engineError("TIMEOUT", "慢");
		assert.equal(normalizeThrown(error), error);
	});
	it("普通 Error 归为 INTERNAL 且保留原始 message", () => {
		const normalized = normalizeThrown(new Error("boom"));
		assert.equal(isEngineError(normalized), true);
		assert.equal(normalized.code, "INTERNAL");
		assert.equal(normalized.message, "boom");
	});
	it("字符串抛出物归为 INTERNAL", () => {
		const normalized = normalizeThrown("raw failure");
		assert.equal(normalized.code, "INTERNAL");
		assert.equal(normalized.message, "raw failure");
	});
	it("已知驱动错误码归类为 DRIVER_ERROR", () => {
		const error = new Error("sqlite failed");
		error.code = "ERR_SQLITE_ERROR";
		assert.equal(normalizeThrown(error).code, "DRIVER_ERROR");
		const rangeError = new Error("out of range");
		rangeError.code = "ERR_OUT_OF_RANGE";
		assert.equal(normalizeThrown(rangeError).code, "DRIVER_ERROR");
	});
	it("其他字符串 code 保留在 detail 中但码为 INTERNAL", () => {
		const error = new Error("weird");
		error.code = "ERR_WEIRD";
		const normalized = normalizeThrown(error);
		assert.equal(normalized.code, "INTERNAL");
		assert.deepEqual(normalized.detail, { driverCode: "ERR_WEIRD" });
	});
});

describe("ok / fail 信封", () => {
	it("ok 包裹数据", () => {
		assert.deepEqual(ok({ a: 1 }), { ok: true, data: { a: 1 } });
	});
	it("fail 无 detail 时省略 detail 字段", () => {
		const envelope = fail(engineError("BAD_REQUEST", "坏"));
		assert.deepEqual(envelope, {
			ok: false,
			error: { code: "BAD_REQUEST", message: "坏" },
		});
	});
	it("fail 有 detail 时携带 detail", () => {
		const envelope = fail(engineError("BAD_REQUEST", "坏", "raw"));
		assert.equal(envelope.error.detail, "raw");
	});
});

describe("jsonReplacer / stringifyJson", () => {
	it("安全范围内 BigInt → Number", () => {
		assert.equal(jsonReplacer("k", 42n), 42);
		assert.equal(JSON.parse(stringifyJson({ v: 1n })).v, 1);
	});
	it("超安全范围 BigInt → 十进制字符串", () => {
		const huge = BigInt(Number.MAX_SAFE_INTEGER) + 10n;
		const replaced = jsonReplacer("k", huge);
		assert.equal(typeof replaced, "string");
		assert.equal(replaced, huge.toString());
		assert.doesNotThrow(() => stringifyJson({ huge }));
	});
	it("Uint8Array → blob 结构（base64 + 字节数）", () => {
		const blob = jsonReplacer("k", new Uint8Array([1, 2, 255]));
		assert.equal(blob.__type, "blob");
		assert.equal(blob.bytes, 3);
		assert.equal(blob.base64, Buffer.from([1, 2, 255]).toString("base64"));
	});
	it("普通值原样返回", () => {
		assert.equal(jsonReplacer("k", "text"), "text");
		assert.equal(jsonReplacer("k", null), null);
		assert.equal(jsonReplacer("k", 3.14), 3.14);
	});
});
