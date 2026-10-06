/**
 * 按表真实列结构生成 SQL 模板的测试 — 防止退回写死 column1/value1 的 demo。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateTableSql } from "../features/database-workspace/services/table-sql-template.ts";

const cols = [
	{ name: "id", type: "integer", nullable: false, hasDefault: true, defaultValue: "nextval('seq')", comment: "", isPrimaryKey: true },
	{ name: "name", type: "varchar(100)", nullable: false, hasDefault: false, defaultValue: "", comment: "", isPrimaryKey: false },
	{ name: "amount", type: "numeric(12,2)", nullable: true, hasDefault: false, defaultValue: "", comment: "", isPrimaryKey: false },
];

describe("generateTableSql — 按真实列生成", () => {
	it("SELECT 列出真实列名", () => {
		const sql = generateTableSql("select", { qualifiedName: "public.t1", columns: cols });
		assert.equal(sql, "SELECT id, name, amount\nFROM public.t1\nLIMIT 100;");
	});

	it("INSERT 用真实列名 + 按类型给示例值", () => {
		const sql = generateTableSql("insert", { qualifiedName: "public.t1", columns: cols });
		assert.equal(
			sql,
			"INSERT INTO public.t1 (id, name, amount)\nVALUES (0, '', 0);",
		);
	});

	it("UPDATE SET 取非主键列、WHERE 用主键", () => {
		const sql = generateTableSql("update", { qualifiedName: "public.t1", columns: cols });
		assert.equal(sql, "UPDATE public.t1\nSET name = ''\nWHERE id = 0;");
	});

	it("DELETE WHERE 用主键", () => {
		const sql = generateTableSql("delete", { qualifiedName: "public.t1", columns: cols });
		assert.equal(sql, "DELETE FROM public.t1\nWHERE id = 0;");
	});

	it("CREATE 按列结构重建（含主键与默认值）", () => {
		const sql = generateTableSql("create", { qualifiedName: "public.t1", columns: cols });
		assert.match(sql, /^CREATE TABLE public\.t1 \(/);
		assert.match(sql, /id integer NOT NULL DEFAULT nextval\('seq'\)/);
		assert.match(sql, /name varchar\(100\) NOT NULL/);
		assert.match(sql, /PRIMARY KEY \(id\)/);
	});

	it("CREATE 无列信息时给通用占位而不是空列清单", () => {
		const sql = generateTableSql("create", { qualifiedName: "public.t1", columns: [] });
		assert.equal(sql, "CREATE TABLE public.t1 (\n  id INTEGER PRIMARY KEY\n);");
	});

	it("无主键时 UPDATE/DELETE 给通用占位条件", () => {
		const noPk = cols.map((c) => ({ ...c, isPrimaryKey: false }));
		assert.match(generateTableSql("update", { qualifiedName: "t", columns: noPk }), /WHERE condition;/);
		assert.match(generateTableSql("delete", { qualifiedName: "t", columns: noPk }), /WHERE condition;/);
	});

	it("ALTER 方言：SQL Server 不带 COLUMN 关键字，PG 带", () => {
		assert.match(
			generateTableSql("alter", { qualifiedName: "t", columns: [], dbType: "sqlserver" }),
			/ADD new_column/,
		);
		assert.doesNotMatch(
			generateTableSql("alter", { qualifiedName: "t", columns: [], dbType: "postgres" }),
			/ADD new_column;/,
		);
		assert.match(
			generateTableSql("alter", { qualifiedName: "t", columns: [], dbType: "postgres" }),
			/ADD COLUMN new_column/,
		);
	});

	it("DROP 带 IF EXISTS", () => {
		assert.equal(generateTableSql("drop", { qualifiedName: "t", columns: [] }), "DROP TABLE IF EXISTS t;");
	});

	it("含非法字符的列名加双引号", () => {
		const weird = [{ name: "order col", type: "int", nullable: true, hasDefault: false, defaultValue: "", comment: "", isPrimaryKey: false }];
		const sql = generateTableSql("select", { qualifiedName: "t", columns: weird });
		assert.match(sql, /SELECT "order col"/);
	});
});
