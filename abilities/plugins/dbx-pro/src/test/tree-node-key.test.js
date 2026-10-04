import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	columnNodeKey,
	connectionFromNodeKey,
	connectionNodeKey,
	parseTableNodeKey,
	schemaNodeKey,
	tableNodeKey,
	treeNodeKind,
} from "../domain/tree-node-key.ts";

describe("tree node key", () => {
	it("识别四种节点的种类", () => {
		assert.equal(treeNodeKind(connectionNodeKey("c")), "connection");
		assert.equal(treeNodeKind(schemaNodeKey("c", "s")), "schema");
		assert.equal(treeNodeKind(tableNodeKey("c", "s", "t")), "table");
		assert.equal(treeNodeKind(columnNodeKey("c", "s", "t", "col")), "column");
		assert.equal(treeNodeKind("random"), null);
		assert.equal(treeNodeKind(""), null);
	});

	it("普通名字往返无损", () => {
		const key = tableNodeKey("prod", "edw", "order_detail");
		assert.deepEqual(parseTableNodeKey(key), {
			connection: "prod",
			schema: "edw",
			table: "order_detail",
		});
	});

	it("表名含冒号时不被截断", () => {
		// 旧实现用 lastIndexOf(":") 取表名，这里会截成 "detail"。
		assert.deepEqual(parseTableNodeKey(tableNodeKey("c", "public", "order:detail")), {
			connection: "c",
			schema: "public",
			table: "order:detail",
		});
	});

	it("连接名和 schema 同时含冒号仍可还原", () => {
		assert.deepEqual(parseTableNodeKey(tableNodeKey("a:b", "x:y", "z:w")), {
			connection: "a:b",
			schema: "x:y",
			table: "z:w",
		});
	});

	it("无 schema 层时 schema 为空串", () => {
		assert.deepEqual(parseTableNodeKey(tableNodeKey("sqlite-main", undefined, "t")), {
			connection: "sqlite-main",
			schema: "",
			table: "t",
		});
	});

	it("名字含 URL 保留字符也能往返", () => {
		const weird = "a/b?c#d e%f";
		assert.equal(parseTableNodeKey(tableNodeKey("c", "s", weird))?.table, weird);
	});

	it("不同节点不会撞 key", () => {
		const keys = new Set([
			tableNodeKey("c", "s", "t"),
			tableNodeKey("c", "s:t", ""),
			tableNodeKey("c:s", "", "t"),
			columnNodeKey("c", "s", "t", "x"),
			schemaNodeKey("c", "s"),
			connectionNodeKey("c"),
		]);
		assert.equal(keys.size, 6);
	});

	it("从任意带连接名的 key 取连接名", () => {
		assert.equal(connectionFromNodeKey(connectionNodeKey("a:b")), "a:b");
		assert.equal(connectionFromNodeKey(schemaNodeKey("a:b", "s")), "a:b");
		assert.equal(connectionFromNodeKey(tableNodeKey("a:b", "s", "t")), "a:b");
		assert.equal(connectionFromNodeKey("nope"), null);
	});

	it("非表节点的 key 不按表解析", () => {
		assert.equal(parseTableNodeKey(schemaNodeKey("c", "s")), null);
		assert.equal(parseTableNodeKey("table:a"), null);
	});
});