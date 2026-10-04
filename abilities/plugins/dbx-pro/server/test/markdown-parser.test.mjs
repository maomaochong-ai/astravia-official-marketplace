/**
 * markdown-parser 单测 — dbx-mcp 的 Markdown 文本 → 结构化数据。
 * 重点：表格分隔线、空表、PK 多格式识别、连接去重与错误分类。
 * 全部纯函数。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	classifyError,
	dedupeConnections,
	extractDuration,
	parseBulletList,
	parseConnections,
	parseDescribeColumns,
	parseMarkdownTable,
	parseTableList,
	pick,
	textOf,
} from "../src/engine/markdown-parser.mjs";

describe("textOf", () => {
	it("拼接 content 数组的 text", () => {
		assert.equal(textOf({ content: [{ text: "a" }, { text: "b" }] }), "a\nb");
	});
	it("缺失结构返回空串", () => {
		assert.equal(textOf(null), "");
		assert.equal(textOf({}), "");
		assert.equal(textOf({ content: [] }), "");
	});
});

describe("parseMarkdownTable", () => {
	const table = [
		"| id | name |",
		"| --- | --- |",
		"| 1 | Alice |",
		"| 2 | Bob |",
	].join("\n");

	it("解析表头与数据行", () => {
		const { columns, rows } = parseMarkdownTable(table);
		assert.deepEqual(columns, ["id", "name"]);
		assert.equal(rows.length, 2);
		assert.deepEqual(rows[0], { id: "1", name: "Alice" });
		assert.deepEqual(rows[1], { id: "2", name: "Bob" });
	});

	it("空表（只有表头 + 分隔线）→ 空 rows", () => {
		const empty = "| a | b |\n| --- | --- |";
		const { columns, rows } = parseMarkdownTable(empty);
		assert.deepEqual(columns, ["a", "b"]);
		assert.deepEqual(rows, []);
	});

	it("缺列单元格补空串（行比表头短）", () => {
		const ragged = "| a | b |\n| - | - |\n| 1 |";
		assert.deepEqual(parseMarkdownTable(ragged).rows[0], { a: "1", b: "" });
	});

	it("非表格文本返回空结构", () => {
		assert.deepEqual(parseMarkdownTable("just text"), { columns: [], rows: [] });
		assert.deepEqual(parseMarkdownTable("| only header"), { columns: [], rows: [] });
	});

	it("转义的管道符被正确还原", () => {
		const escaped = "| a |\n| - |\n| x\\|y |";
		assert.equal(parseMarkdownTable(escaped).rows[0].a, "x\\|y");
	});
});

describe("pick", () => {
	const row = { a: "", b: "value", c: "x" };
	it("按候选名取第一个非空值", () => {
		assert.equal(pick(row, ["a", "b", "c"]), "value");
	});
	it("全部缺失/为空时返回空串", () => {
		assert.equal(pick(row, ["a", "z"]), "");
	});
});

describe("parseBulletList", () => {
	it("解析 - 与 * 前缀", () => {
		assert.deepEqual(parseBulletList("- a\n* b"), ["a", "b"]);
	});
	it("非列表行被忽略", () => {
		assert.deepEqual(parseBulletList("not a list"), []);
	});
});

describe("parseTableList", () => {
	it("解析无序列表格式：name (KIND)，兼容注释后缀", () => {
		const text = "- users (BASE TABLE)\n- orders (BASE TABLE) -- 订单\n- v_events (VIEW)";
		const tables = parseTableList(text);
		assert.equal(tables.length, 3);
		assert.deepEqual(tables[0], { name: "users", kind: "BASE TABLE" });
		assert.deepEqual(tables[1], { name: "orders", kind: "BASE TABLE" });
		assert.deepEqual(tables[2], { name: "v_events", kind: "VIEW" });
	});

	it("无 kind 的条目 kind 为空串", () => {
		assert.deepEqual(parseTableList("- plain_item")[0], { name: "plain_item", kind: "" });
	});

	it("兜底解析 Markdown 表格格式", () => {
		const table = "| Name | Type |\n| --- | --- |\n| t1 | BASE TABLE |";
		const tables = parseTableList(table);
		assert.equal(tables.length, 1);
		assert.deepEqual(tables[0], { name: "t1", kind: "BASE TABLE" });
	});
});

describe("parseDescribeColumns — PK 多格式识别", () => {
	it("列名单元格带 (PK)", () => {
		const rows = [{ Column: "id (PK)", Type: "integer", Nullable: "NO", Key: "" }];
		const column = parseDescribeColumns(rows)[0];
		assert.equal(column.isPrimaryKey, true);
		assert.equal(column.name, "id");
	});

	it("Key 列 PRI 识别（MySQL 格式）", () => {
		const rows = [{ name: "id", Type: "int", Nullable: "NO", Key: "PRI" }];
		assert.equal(parseDescribeColumns(rows)[0].isPrimaryKey, true);
	});

	it("普通列不是主键", () => {
		const rows = [{ Name: "name", type: "text", nullable: "YES", Key: "" }];
		const column = parseDescribeColumns(rows)[0];
		assert.equal(column.isPrimaryKey, false);
		assert.equal(column.nullable, true);
		assert.equal(column.type, "text");
	});

	it("默认值字段解析", () => {
		const rows = [{ Name: "status", Type: "text", Default: "'active'", Key: "", Nullable: "NO" }];
		const column = parseDescribeColumns(rows)[0];
		assert.equal(column.hasDefault, true);
		assert.equal(column.defaultValue, "'active'");
		assert.equal(column.nullable, false);
	});

	it("Nullable 缺省按 YES 处理", () => {
		const rows = [{ Name: "x", Type: "text", Key: "" }];
		assert.equal(parseDescribeColumns(rows)[0].nullable, true);
	});
});

describe("dedupeConnections", () => {
	it("按 id 去重，首次出现胜出", () => {
		const input = [
			{ id: "1", name: "a" },
			{ id: "1", name: "different" },
			{ id: "2", name: "b" },
		];
		const result = dedupeConnections(input);
		assert.equal(result.length, 2);
		assert.equal(result[0].name, "a");
	});

	it("按 name 兜底去重", () => {
		const input = [{ id: "", name: "x" }, { id: "", name: "x" }];
		assert.equal(dedupeConnections(input).length, 1);
	});

	it("无 id 无 name 的行保留", () => {
		assert.equal(dedupeConnections([{}]).length, 1);
	});
});

describe("parseConnections", () => {
	it("解析连接表并做数值字段转换", () => {
		const text = [
			"| ID | Name | Type | Host | Port | Database |",
			"| --- | --- | --- | --- | --- | --- |",
			"| id-1 | mydb | postgres | localhost | 5432 | app |",
		].join("\n");
		const connections = parseConnections(text);
		assert.equal(connections.length, 1);
		assert.deepEqual(connections[0], {
			id: "id-1",
			name: "mydb",
			groupPath: "",
			type: "postgres",
			host: "localhost",
			port: 5432,
			database: "app",
		});
	});

	it("非数字端口归一为 0", () => {
		const text = "| id | name | type | host | port | database |\n| --- | --- | --- | --- | --- | --- |\n| 1 | x | redis | h | n/a | |";
		assert.equal(parseConnections(text)[0].port, 0);
	});
});

describe("classifyError", () => {
	const cases = [
		["SQL_BLOCKED by policy", "SQL_BLOCKED"],
		["Connection \"x\" not found", "CONNECTION_NOT_FOUND"],
		["server is in read-only mode", "READ_ONLY"],
		["Connection already exists", "CONNECTION_EXISTS"],
		["Unsupported database type: x", "INVALID_PARAMS"],
		["request timed out", "TIMEOUT"],
		["connection refused", "CONNECTION_FAILED"],
		["some totally new failure", "UNKNOWN"],
	];
	for (const [input, code] of cases) {
		it(`${code}`, () => assert.equal(classifyError(input).code, code));
	}
	it("空输入归为 UNKNOWN", () => {
		assert.equal(classifyError("").code, "UNKNOWN");
	});
});

describe("extractDuration", () => {
	it("识别 ms 与 s", () => {
		assert.equal(extractDuration("took 12ms"), "12ms");
		assert.equal(extractDuration("took 0.5s"), "0.5s");
	});
	it("无耗时信息返回空串", () => {
		assert.equal(extractDuration("no timing"), "");
	});
});
