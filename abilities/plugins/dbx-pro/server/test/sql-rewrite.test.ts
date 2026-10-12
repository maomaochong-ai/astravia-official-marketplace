/**
 * sql-rewrite.test.ts — SQL 表名重写。
 *
 * 测试 tokenize / findTableRefs / rewriteApiTableRefs / referencedIn。
 * 纯函数模块，不接触网络 / 文件系统。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	tokenize,
	findTableRefs,
	rewriteApiTableRefs,
	referencedIn,
	rewriteForApiSources,
} from "../src/api/external/sql-rewrite.ts";

describe("sql-rewrite · tokenize", () => {
	it("基本标识符和空白", () => {
		const tokens = tokenize("SELECT a FROM t");
		const idents = tokens.filter((t) => t.kind === "ident").map((t) => t.text);
		assert.deepEqual(idents, ["SELECT", "a", "FROM", "t"]);
	});

	it("字符串字面量为 opaque", () => {
		const tokens = tokenize("SELECT 'hello world'");
		const opaque = tokens.filter((t) => t.kind === "opaque");
		assert.ok(opaque.some((t) => t.text.includes("'hello world'")));
	});

	it("引号标识符为 quoted", () => {
		const tokens = tokenize('SELECT "Column Name"');
		const quoted = tokens.filter((t) => t.kind === "quoted");
		assert.equal(quoted.length, 1);
		assert.equal(quoted[0].name, "Column Name");
	});

	it("反引号标识符为 quoted", () => {
		const tokens = tokenize("SELECT `column`");
		const quoted = tokens.filter((t) => t.kind === "quoted");
		assert.equal(quoted.length, 1);
		assert.equal(quoted[0].name, "column");
	});

	it("行注释为 opaque", () => {
		const tokens = tokenize("SELECT 1 -- comment");
		const opaque = tokens.filter((t) => t.kind === "opaque");
		assert.ok(opaque.some((t) => t.text.includes("-- comment")));
	});

	it("块注释为 opaque", () => {
		const tokens = tokenize("SELECT /* block */ 1");
		const opaque = tokens.filter((t) => t.kind === "opaque");
		assert.ok(opaque.some((t) => t.text.includes("/* block */")));
	});

	it("数字为 opaque", () => {
		const tokens = tokenize("SELECT 123, 0x1F, 3.14");
		const opaque = tokens.filter((t) => t.kind === "opaque");
		assert.ok(opaque.length >= 3);
	});

	it("中文字符为标识符", () => {
		const tokens = tokenize("SELECT * FROM 订单");
		const idents = tokens.filter((t) => t.kind === "ident");
		assert.ok(idents.some((t) => t.text === "订单"));
	});

	it("带连字符的标识符", () => {
		const tokens = tokenize("SELECT * FROM api-users");
		const idents = tokens.filter((t) => t.kind === "ident");
		assert.ok(idents.some((t) => t.text === "api-users"));
	});

	it("字符串内的引号不结束标识符", () => {
		const tokens = tokenize("SELECT 'it''s a test'");
		const opaque = tokens.filter((t) => t.kind === "opaque");
		assert.ok(opaque.some((t) => t.text.includes("'it''s a test'")));
	});
});

describe("sql-rewrite · findTableRefs", () => {
	it("找到 FROM 后的表名", () => {
		const tokens = tokenize("SELECT * FROM users");
		const refs = findTableRefs(tokens);
		assert.equal(refs.length, 1);
		assert.equal(tokens[refs[0].index].text, "users");
	});

	it("找到 JOIN 后的表名", () => {
		const tokens = tokenize("SELECT * FROM users JOIN orders ON users.id = orders.user_id");
		const refs = findTableRefs(tokens);
		assert.equal(refs.length, 2);
	});

	it("识别已有别名", () => {
		const tokens = tokenize("SELECT * FROM users u");
		const refs = findTableRefs(tokens);
		assert.equal(refs[0].hasAlias, true);
	});

	it("识别 AS 别名", () => {
		const tokens = tokenize("SELECT * FROM users AS u");
		const refs = findTableRefs(tokens);
		assert.equal(refs[0].hasAlias, true);
	});

	it("无别名", () => {
		const tokens = tokenize("SELECT * FROM users WHERE id = 1");
		const refs = findTableRefs(tokens);
		assert.equal(refs[0].hasAlias, false);
	});

	it("多个表", () => {
		const tokens = tokenize("SELECT * FROM a, b, c");
		const refs = findTableRefs(tokens);
		assert.equal(refs.length, 3);
	});

	it("子查询内的表", () => {
		const tokens = tokenize("SELECT * FROM (SELECT * FROM inner_table) AS sub");
		const refs = findTableRefs(tokens);
		assert.equal(refs.length, 1);
	});
});

describe("sql-rewrite · rewriteApiTableRefs", () => {
	it("重写单个表名", () => {
		const paths = new Map([["posts", "/data/posts.ndjson"]]);
		const result = rewriteApiTableRefs("SELECT * FROM posts", paths);
		assert.match(result.sql, /read_json_auto\('\/data\/posts\.ndjson'\)/);
		assert.match(result.sql, /AS "posts"/);
		assert.deepEqual(result.replaced, ["posts"]);
		assert.equal(result.changed, true);
	});

	it("表名已有别名时不加别名", () => {
		const paths = new Map([["posts", "/data/posts.ndjson"]]);
		const result = rewriteApiTableRefs("SELECT * FROM posts p", paths);
		assert.match(result.sql, /read_json_auto\('\/data\/posts\.ndjson'\)/);
		assert.equal(result.sql.includes('AS "posts"'), false);
	});

	it("重写多个表名", () => {
		const paths = new Map([
			["users", "/data/users.ndjson"],
			["orders", "/data/orders.ndjson"],
		]);
		const result = rewriteApiTableRefs("SELECT * FROM users JOIN orders ON users.id = orders.user_id", paths);
		assert.match(result.sql, /read_json_auto\('\/data\/users\.ndjson'\)/);
		assert.match(result.sql, /read_json_auto\('\/data\/orders\.ndjson'\)/);
		assert.equal(result.replaced.length, 2);
	});

	it("不重写不在 paths 中的表", () => {
		const paths = new Map([["api_data", "/data/api.ndjson"]]);
		const result = rewriteApiTableRefs("SELECT * FROM regular_table", paths);
		assert.equal(result.sql, "SELECT * FROM regular_table");
		assert.equal(result.changed, false);
	});

	it("大小写不敏感匹配", () => {
		const paths = new Map([["posts", "/data/posts.ndjson"]]);
		const result = rewriteApiTableRefs("SELECT * FROM POSTS", paths);
		assert.match(result.sql, /read_json_auto/);
	});

	it("保留注释", () => {
		const paths = new Map([["t", "/data/t.ndjson"]]);
		const result = rewriteApiTableRefs("SELECT * /* comment */ FROM t", paths);
		assert.match(result.sql, /\/\* comment \*\//);
	});

	it("保留字符串字面量", () => {
		const paths = new Map([["t", "/data/t.ndjson"]]);
		const result = rewriteApiTableRefs("SELECT * FROM t WHERE name = 'from t'", paths);
		assert.match(result.sql, /'from t'/);
	});

	it("路径中的单引号转义", () => {
		const paths = new Map([["t", "/data/it's.ndjson"]]);
		const result = rewriteApiTableRefs("SELECT * FROM t", paths);
		assert.match(result.sql, /it''s\.ndjson/);
	});

	it("接受 Record 类型的 paths", () => {
		const paths = { posts: "/data/posts.ndjson" };
		const result = rewriteApiTableRefs("SELECT * FROM posts", paths);
		assert.match(result.sql, /read_json_auto/);
	});
});

describe("sql-rewrite · referencedIn", () => {
	it("找到引用的标识符", () => {
		const tokens = tokenize("SELECT posts.id FROM posts");
		assert.equal(referencedIn(tokens, "posts"), true);
		assert.equal(referencedIn(tokens, "id"), true);
	});

	it("未引用的标识符", () => {
		const tokens = tokenize("SELECT * FROM users");
		assert.equal(referencedIn(tokens, "orders"), false);
	});

	it("大小写不敏感", () => {
		const tokens = tokenize("SELECT * FROM Users");
		assert.equal(referencedIn(tokens, "users"), true);
		assert.equal(referencedIn(tokens, "USERS"), true);
	});
});

describe("sql-rewrite · rewriteForApiSources", () => {
	it("按名字列表重写", () => {
		const pathFor = (name: string) => `/data/${name}.ndjson`;
		const result = rewriteForApiSources("SELECT * FROM posts", ["posts"], pathFor);
		assert.match(result.sql, /read_json_auto\('\/data\/posts\.ndjson'\)/);
	});

	it("referenced 只包含 SQL 里出现过的", () => {
		const pathFor = (name: string) => `/data/${name}.ndjson`;
		const result = rewriteForApiSources("SELECT * FROM posts", ["posts", "users"], pathFor);
		assert.deepEqual(result.referenced, ["posts"]);
	});

	it("路径为空时抛错", () => {
		const pathFor = () => null;
		assert.throws(() => rewriteForApiSources("SELECT * FROM posts", ["posts"], pathFor));
	});
});
