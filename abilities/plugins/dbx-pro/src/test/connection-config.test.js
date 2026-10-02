/**
 * connection-config manifest 完整性 + family 推断测试。
 * node --test 运行。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// DB_TYPE_MANIFEST 直接复制关键结构（与 TS 源保持一致）
const DB_TYPE_MANIFEST = [
	{ dbType: "postgres", family: "schemas", defaultPort: 5432, runtimeMode: "native" },
	{ dbType: "mysql", family: "schemas", defaultPort: 3306, runtimeMode: "native" },
	{ dbType: "sqlite", family: "flat", defaultPort: 0, runtimeMode: "native" },
	{ dbType: "cloudflare-d1", family: "flat", defaultPort: 0, runtimeMode: "native" },
	{ dbType: "mongodb", family: "flat", defaultPort: 27017, runtimeMode: "bridge" },
	{ dbType: "snowflake", family: "schemas", defaultPort: 443, runtimeMode: "bridge" },
	{ dbType: "clickhouse", family: "flat", defaultPort: 8123, runtimeMode: "native" },
	{ dbType: "redis", family: "flat", defaultPort: 6379, runtimeMode: "native" },
	{ dbType: "duckdb", family: "flat", defaultPort: 0, runtimeMode: "native" },
	{ dbType: "redshift", family: "schemas", defaultPort: 5439, runtimeMode: "native" },
];

function findDbType(dbType) { return DB_TYPE_MANIFEST.find((e) => e.dbType === dbType); }
function inferFamily(dbType) { return findDbType(dbType)?.family ?? "flat"; }
function defaultPortFor(dbType) { return findDbType(dbType)?.defaultPort ?? 0; }

describe("DB_TYPE_MANIFEST integrity", () => {
	it("no duplicate dbType", () => {
		const seen = new Set();
		for (const e of DB_TYPE_MANIFEST) {
			assert.equal(seen.has(e.dbType), false, `duplicate dbType: ${e.dbType}`);
			seen.add(e.dbType);
		}
	});
	it("all family values valid", () => {
		for (const e of DB_TYPE_MANIFEST) {
			assert.ok(["schemas", "databases", "flat"].includes(e.family), `${e.dbType}: bad family`);
		}
	});
	it("defaultPort is number", () => {
		for (const e of DB_TYPE_MANIFEST) {
			assert.equal(typeof e.defaultPort, "number", `${e.dbType}: port not number`);
			assert.ok(e.defaultPort >= 0, `${e.dbType}: negative port`);
		}
	});
	it("runtimeMode is native or bridge", () => {
		for (const e of DB_TYPE_MANIFEST) {
			assert.ok(["native", "bridge"].includes(e.runtimeMode), `${e.dbType}: bad runtimeMode`);
		}
	});
	it("postgres → schemas", () => { assert.equal(inferFamily("postgres"), "schemas"); });
	it("mysql → schemas", () => { assert.equal(inferFamily("mysql"), "schemas"); });
	it("sqlite → flat", () => { assert.equal(inferFamily("sqlite"), "flat"); });
	it("mongodb → flat (bridge)", () => { assert.equal(inferFamily("mongodb"), "flat"); });
	it("unknown dbType → flat fallback", () => { assert.equal(inferFamily("bogusdb"), "flat"); });
	it("postgres defaultPort 5432", () => { assert.equal(defaultPortFor("postgres"), 5432); });
	it("unknown defaultPort 0", () => { assert.equal(defaultPortFor("bogusdb"), 0); });
	it("cloudflare-d1 port 0 (file-based)", () => { assert.equal(defaultPortFor("cloudflare-d1"), 0); });
});
