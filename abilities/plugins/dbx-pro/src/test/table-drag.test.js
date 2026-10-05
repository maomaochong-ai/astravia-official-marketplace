/**
 * 连接树拖拽协议测试 — 载荷构造、插入文本与 dataTransfer 往返。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	buildTableDragPayload,
	readTableDragPayload,
	tableDragInsertText,
	writeTableDragPayload,
} from "../domain/table-drag.ts";

describe("table drag payload", () => {
	it("表节点生成 schema.table 限定名", () => {
		const payload = buildTableDragPayload("table", {
			connectionName: "pgsql-dev",
			schema: "edw",
			tableName: "orders",
			label: "orders",
		});
		assert.equal(payload.qualifiedName, "edw.orders");
		assert.equal(tableDragInsertText(payload), "edw.orders");
	});

	it("无 schema 层的表节点只用表名", () => {
		const payload = buildTableDragPayload("table", {
			connectionName: "sqlite-main",
			label: "users",
		});
		assert.equal(tableDragInsertText(payload), "users");
	});

	it("列节点插入原始列名而非限定名", () => {
		const payload = buildTableDragPayload("column", {
			connectionName: "pgsql-dev",
			schema: "public",
			tableName: "users",
			columnName: "order:id",
			label: "order:id",
		});
		assert.equal(tableDragInsertText(payload), "order:id");
	});

	it("schema / 连接节点插入节点名本身", () => {
		const schemaPayload = buildTableDragPayload("schema", {
			connectionName: "c",
			label: "edw",
		});
		assert.equal(tableDragInsertText(schemaPayload), "edw");

		const connPayload = buildTableDragPayload("connection", {
			connectionName: "pgsql-dev",
			label: "pgsql-dev",
		});
		assert.equal(tableDragInsertText(connPayload), "pgsql-dev");
	});

	it("dataTransfer 写入后可结构化读回，且含 text/plain 兜底", () => {
		if (typeof DataTransfer === "undefined") return; // 环境不支持时跳过往返
		const payload = buildTableDragPayload("table", {
			connectionName: "c",
			schema: "s",
			tableName: "t",
			label: "t",
		});
		const dt = new DataTransfer();
		writeTableDragPayload(dt, payload);
		assert.equal(readTableDragPayload(dt)?.tableName, "t");
		assert.equal(dt.getData("text/plain"), "s.t");
		assert.equal(dt.effectAllowed, "copy");
	});

	it("非法 JSON 载荷返回 null，不抛异常", () => {
		if (typeof DataTransfer === "undefined") return;
		const dt = new DataTransfer();
		dt.setData("application/x-dbx-node", "{not-json");
		assert.equal(readTableDragPayload(dt), null);
	});
});
