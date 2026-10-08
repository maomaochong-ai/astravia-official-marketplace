import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	columnNodeKey,
	connectionFromNodeKey,
	connectionNodeKey,
	parseColumnNodeKey,
	parseRoutineNodeKey,
	parseRoutinesFolderKey,
	parseTableNodeKey,
	routineNodeKey,
	routinesFolderNodeKey,
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

	it("列节点 key 还原连接 / schema / 表 / 列", () => {
		assert.deepEqual(parseColumnNodeKey(columnNodeKey("pgsql", "edw", "orders", "order:id")), {
			connection: "pgsql",
			schema: "edw",
			table: "orders",
			column: "order:id",
		});
	});

	it("非列节点的 key 不按列解析", () => {
		assert.equal(parseColumnNodeKey(tableNodeKey("c", "s", "t")), null);
		assert.equal(parseColumnNodeKey("col:only-one"), null);
	});

	it("识别例程分组 / 例程节点", () => {
		assert.equal(treeNodeKind(routinesFolderNodeKey("c", "s")), "routine-folder");
		assert.equal(treeNodeKind(routineNodeKey("c", "s", "f")), "routine");
	});

	it("例程 key 名字含冒号仍可还原", () => {
		assert.deepEqual(parseRoutinesFolderKey(routinesFolderNodeKey("a:b", "x:y")), {
			connection: "a:b",
			schema: "x:y",
		});
		assert.deepEqual(parseRoutineNodeKey(routineNodeKey("a:b", "x:y", "f(a int)")), {
			connection: "a:b",
			schema: "x:y",
			routine: "f(a int)",
		});
	});

	it("无 schema 层的库，例程 schema 为空串", () => {
		assert.deepEqual(parseRoutineNodeKey(routineNodeKey("sqlite", undefined, "f")), {
			connection: "sqlite",
			schema: "",
			routine: "f",
		});
	});

	it("非例程 key 不按例程解析", () => {
		assert.equal(parseRoutineNodeKey(tableNodeKey("c", "s", "t")), null);
		assert.equal(parseRoutinesFolderKey(routineNodeKey("c", "s", "f")), null);
		assert.equal(parseRoutineNodeKey("routine:a:b"), null);
	});

	// invalidateConnectionTree 靠 connectionFromNodeKey 判断「是不是这棵子树的」，
	// 例程节点的连接名解不出来，刷新连接时就会留下一堆陈旧例程。
	it("例程节点也能取到连接名", () => {
		assert.equal(connectionFromNodeKey(routinesFolderNodeKey("a:b", "s")), "a:b");
		assert.equal(connectionFromNodeKey(routineNodeKey("a:b", "x:y", "f")), "a:b");
	});

	it("例程与例程分组不会撞 key", () => {
		const keys = new Set([
			routinesFolderNodeKey("c", "s"),
			routineNodeKey("c", "s", ""),
			routineNodeKey("c", "", "s"),
			schemaNodeKey("c", "s"),
		]);
		assert.equal(keys.size, 4);
	});
});