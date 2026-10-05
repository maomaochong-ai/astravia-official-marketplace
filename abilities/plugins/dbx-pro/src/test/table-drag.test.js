/**
 * 连接树拖拽协议测试 — 拖入宿主 AI 对话框的引用文本构造与 dataTransfer 写入。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildNodeReferenceText, writeNodeDragPayload } from "../domain/table-drag.ts";

describe("node drag reference text", () => {
	it("表节点生成 schema.table 限定名", () => {
		assert.equal(
			buildNodeReferenceText("table", {
				connectionName: "pgsql-dev",
				schema: "edw",
				tableName: "orders",
				label: "orders",
			}),
			"edw.orders",
		);
	});

	it("无 schema 层的表节点只用表名", () => {
		assert.equal(
			buildNodeReferenceText("table", { connectionName: "sqlite-main", label: "users" }),
			"users",
		);
	});

	it("列节点带出所属表：schema.table.column", () => {
		assert.equal(
			buildNodeReferenceText("column", {
				connectionName: "pgsql-dev",
				schema: "public",
				tableName: "users",
				columnName: "order:id",
				label: "order:id",
			}),
			"public.users.order:id",
		);
	});

	it("无 schema 时列引用为 table.column", () => {
		assert.equal(
			buildNodeReferenceText("column", {
				connectionName: "sqlite-main",
				tableName: "users",
				columnName: "id",
				label: "id",
			}),
			"users.id",
		);
	});

	it("schema / 连接节点插入节点名本身", () => {
		assert.equal(
			buildNodeReferenceText("schema", { connectionName: "c", label: "edw" }),
			"edw",
		);
		assert.equal(
			buildNodeReferenceText("connection", { connectionName: "pgsql-dev", label: "pgsql-dev" }),
			"pgsql-dev",
		);
	});

	it("dataTransfer 写入 text/plain 兜底与来源标记", () => {
		if (typeof DataTransfer === "undefined") return; // 环境不支持时跳过
		const dt = new DataTransfer();
		writeNodeDragPayload(dt, "table", {
			connectionName: "c",
			schema: "s",
			tableName: "t",
			label: "t",
		});
		assert.equal(dt.getData("text/plain"), "s.t");
		assert.equal(dt.getData("application/x-dbx-node"), "table");
		assert.equal(dt.effectAllowed, "copy");
	});
});
