/**
 * protocol.test.ts — 引擎协议层。
 *
 * 测试 httpStatusForCode / EngineError / engineError / isEngineError /
 * normalizeThrown / ok / fail / jsonReplacer / stringifyJson。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	httpStatusForCode,
	EngineError,
	engineError,
	isEngineError,
	normalizeThrown,
	ok,
	fail,
	jsonReplacer,
	stringifyJson,
	ENGINE_VERSION,
	PROTOCOL_VERSION,
} from "../src/engine/protocol.ts";

describe("protocol · httpStatusForCode", () => {
	it("已知错误码返回对应状态", () => {
		assert.equal(httpStatusForCode("BAD_REQUEST"), 400);
		assert.equal(httpStatusForCode("UNAUTHORIZED"), 401);
		assert.equal(httpStatusForCode("NOT_FOUND"), 404);
		assert.equal(httpStatusForCode("SQL_BLOCKED"), 403);
		assert.equal(httpStatusForCode("TIMEOUT"), 504);
		assert.equal(httpStatusForCode("INTERNAL"), 500);
	});

	it("未知错误码返回 500", () => {
		assert.equal(httpStatusForCode("UNKNOWN_CODE"), 500);
	});
});

describe("protocol · EngineError", () => {
	it("构造错误", () => {
		const err = new EngineError("BAD_REQUEST", "Invalid input");
		assert.equal(err.code, "BAD_REQUEST");
		assert.equal(err.message, "Invalid input");
		assert.equal(err.engineError, true);
		assert.equal(err.name, "EngineError");
	});

	it("带 detail", () => {
		const err = new EngineError("BAD_REQUEST", "Invalid", { field: "name" });
		assert.deepEqual(err.detail, { field: "name" });
	});

	it("是 Error 实例", () => {
		const err = new EngineError("BAD_REQUEST", "test");
		assert.ok(err instanceof Error);
	});
});

describe("protocol · engineError", () => {
	it("工厂函数创建错误", () => {
		const err = engineError("NOT_FOUND", "Resource not found");
		assert.ok(isEngineError(err));
		assert.equal(err.code, "NOT_FOUND");
	});
});

describe("protocol · isEngineError", () => {
	it("识别 EngineError", () => {
		const err = new EngineError("BAD_REQUEST", "test");
		assert.equal(isEngineError(err), true);
	});

	it("识别鸭子类型", () => {
		const duckError = { engineError: true, code: "CUSTOM", message: "test" };
		assert.equal(isEngineError(duckError), true);
	});

	it("拒绝非错误对象", () => {
		assert.equal(isEngineError(null), false);
		assert.equal(isEngineError(undefined), false);
		assert.equal(isEngineError({}), false);
		assert.equal(isEngineError({ code: "TEST" }), false);
		assert.equal(isEngineError({ engineError: true }), false);
		assert.equal(isEngineError("error"), false);
		assert.equal(isEngineError(123), false);
	});
});

describe("protocol · normalizeThrown", () => {
	it("EngineError 原样返回", () => {
		const err = new EngineError("BAD_REQUEST", "test");
		const normalized = normalizeThrown(err);
		assert.equal(normalized, err);
	});

	it("Error 转为 INTERNAL", () => {
		const err = new Error("Something failed");
		const normalized = normalizeThrown(err);
		assert.equal(normalized.code, "INTERNAL");
		assert.equal(normalized.message, "Something failed");
	});

	it("字符串转为 INTERNAL", () => {
		const normalized = normalizeThrown("string error");
		assert.equal(normalized.code, "INTERNAL");
		assert.equal(normalized.message, "string error");
	});

	it("带 code 的 Error 保留 driverCode", () => {
		const err = Object.assign(new Error("SQLite error"), { code: "ERR_SQLITE_ERROR" });
		const normalized = normalizeThrown(err);
		assert.equal(normalized.code, "DRIVER_ERROR");
		assert.deepEqual(normalized.detail, { driverCode: "ERR_SQLITE_ERROR" });
	});

	it("其他 code 保留", () => {
		const err = Object.assign(new Error("Custom error"), { code: "CUSTOM_CODE" });
		const normalized = normalizeThrown(err);
		assert.equal(normalized.code, "INTERNAL");
		assert.deepEqual(normalized.detail, { driverCode: "CUSTOM_CODE" });
	});
});

describe("protocol · ok", () => {
	it("包装成功响应", () => {
		const result = ok({ id: 1, name: "test" });
		assert.equal(result.ok, true);
		assert.deepEqual(result.data, { id: 1, name: "test" });
	});
});

describe("protocol · fail", () => {
	it("包装 EngineError", () => {
		const err = new EngineError("BAD_REQUEST", "Invalid input");
		const result = fail(err);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "BAD_REQUEST");
		assert.equal(result.error.message, "Invalid input");
	});

	it("包装普通 Error", () => {
		const err = new Error("Something failed");
		const result = fail(err);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "INTERNAL");
		assert.equal(result.error.message, "Something failed");
	});

	it("带 detail 的错误", () => {
		const err = new EngineError("BAD_REQUEST", "Invalid", { field: "name" });
		const result = fail(err);
		assert.deepEqual(result.error.detail, { field: "name" });
	});
});

describe("protocol · jsonReplacer", () => {
	it("BigInt 安全值转 Number", () => {
		const result = jsonReplacer("", BigInt(123));
		assert.equal(result, 123);
	});

	it("BigInt 超范围转字符串", () => {
		const big = BigInt("9007199254740992");
		const result = jsonReplacer("", big);
		assert.equal(result, "9007199254740992");
	});

	it("Uint8Array 转 blob 对象", () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const result = jsonReplacer("", bytes);
		assert.equal((result as { __type: string }).__type, "blob");
		assert.equal((result as { bytes: number }).bytes, 3);
		assert.ok((result as { base64: string }).base64);
	});

	it("其他值原样返回", () => {
		assert.equal(jsonReplacer("", "string"), "string");
		assert.equal(jsonReplacer("", 123), 123);
		assert.equal(jsonReplacer("", null), null);
		assert.deepEqual(jsonReplacer("", { a: 1 }), { a: 1 });
	});
});

describe("protocol · stringifyJson", () => {
	it("序列化普通对象", () => {
		const result = stringifyJson({ id: 1, name: "test" });
		assert.equal(result, '{"id":1,"name":"test"}');
	});

	it("序列化 BigInt", () => {
		const result = stringifyJson({ big: BigInt(123) });
		assert.equal(result, '{"big":123}');
	});

	it("序列化 Uint8Array", () => {
		const result = stringifyJson({ data: new Uint8Array([1, 2, 3]) });
		assert.match(result, /"__type":"blob"/);
	});
});

describe("protocol · constants", () => {
	it("版本常量存在", () => {
		assert.ok(ENGINE_VERSION);
		assert.equal(typeof ENGINE_VERSION, "string");
		assert.equal(typeof PROTOCOL_VERSION, "number");
	});
});
