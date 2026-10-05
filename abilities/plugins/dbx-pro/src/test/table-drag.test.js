/**
 * 连接树拖拽协议测试 —— 拖入宿主 AI 输入框的 @提及 token 与多选分组。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildNodeMention, buildNodesMentionText, writeAiNodeDrag } from "../domain/table-drag.ts";

describe("buildNodeMention", () => {
	it("连接：@`连接名`", () => {
		assert.equal(
			buildNodeMention({ kind: "connection", connectionName: "pgsql-dev", label: "pgsql-dev" }),
			"@`pgsql-dev`",
		);
	});

	it("表：@`连接名:schema.表名`", () => {
		assert.equal(
			buildNodeMention({ kind: "table", connectionName: "pgsql-dev", schema: "edw", tableName: "orders", label: "orders" }),
			"@`pgsql-dev:edw.orders`",
		);
	});

	it("无 schema 层的表：@`连接名:表名`", () => {
		assert.equal(
			buildNodeMention({ kind: "table", connectionName: "sqlite-main", tableName: "users", label: "users" }),
			"@`sqlite-main:users`",
		);
	});

	it("schema：@`schema名`（沿用既有约定）", () => {
		assert.equal(
			buildNodeMention({ kind: "schema", connectionName: "c", label: "edw" }),
			"@`edw`",
		);
	});

	it("列：所属表标签后接纯文本列名", () => {
		assert.equal(
			buildNodeMention({
				kind: "column",
				connectionName: "pgsql-dev",
				schema: "public",
				tableName: "users",
				columnName: "order:id",
				label: "order:id",
			}),
			"@`pgsql-dev:public.users`.order:id",
		);
	});

	it("表名含点号 / 冒号时仍按原样保留在反引号内", () => {
		assert.equal(
			buildNodeMention({ kind: "table", connectionName: "c", schema: "s", tableName: "a.b:c", label: "a.b:c" }),
			"@`c:s.a.b:c`",
		);
	});
});

describe("buildNodesMentionText", () => {
	it("单节点就是它的提及 token", () => {
		const text = buildNodesMentionText([
			{ kind: "table", connectionName: "c", schema: "s", tableName: "t", label: "t" },
		]);
		assert.equal(text, "@`c:s.t`");
	});

	it("多选按连接分组、组内连接→schema→表排序", () => {
		const text = buildNodesMentionText([
			{ kind: "table", connectionName: "p", schema: "public", tableName: "b", label: "b" },
			{ kind: "connection", connectionName: "p", label: "p" },
			{ kind: "schema", connectionName: "p", label: "public" },
			{ kind: "table", connectionName: "p", schema: "public", tableName: "a", label: "a" },
		]);
		assert.equal(text, "@`p` @`public` @`p:public.a` @`p:public.b`");
	});

	it("不同连接的对象各自成组，重复对象去重", () => {
		const text = buildNodesMentionText([
			{ kind: "table", connectionName: "c1", tableName: "t", label: "t" },
			{ kind: "table", connectionName: "c1", tableName: "t", label: "t" },
			{ kind: "table", connectionName: "c2", tableName: "u", label: "u" },
		]);
		assert.equal(text, "@`c1:t` @`c2:u`");
	});

	it("空列表返回空串", () => {
		assert.equal(buildNodesMentionText([]), "");
	});
});

describe("writeAiNodeDrag", () => {
	it("text/plain 为提及文本，结构化 MIME 为 JSON，copy 效果", () => {
		if (typeof DataTransfer === "undefined") return;
		const dt = new DataTransfer();
		const text = writeAiNodeDrag(dt, [
			{ kind: "table", connectionName: "c", schema: "s", tableName: "t", label: "t" },
		]);
		assert.equal(text, "@`c:s.t`");
		assert.equal(dt.getData("text/plain"), "@`c:s.t`");
		assert.deepEqual(JSON.parse(dt.getData("application/x-astravia-dbx-nodes")), [
			{ kind: "table", connectionName: "c", schema: "s", tableName: "t", label: "t" },
		]);
		assert.equal(dt.effectAllowed, "copy");
	});
});
