/**
 * connection-config manifest 完整性 + family 推断测试 — 直接导入被测源码。
 * 运行: node --experimental-strip-types --test src/test/*.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	DB_TYPE_MANIFEST,
	defaultPortFor,
	findDbType,
	inferCatalogFamily,
	runtimeModeFor,
	supportsExplain,
	supportsTableDataEdit,
} from "../domain/connection-config.ts";

describe("DB_TYPE_MANIFEST integrity", () => {
	it("manifest is not empty", () => {
		assert.ok(DB_TYPE_MANIFEST.length > 0);
	});
	it("no duplicate dbType", () => {
		const seen = new Set();
		for (const e of DB_TYPE_MANIFEST) {
			assert.equal(seen.has(e.dbType), false, `duplicate dbType: ${e.dbType}`);
			seen.add(e.dbType);
		}
	});
	it("every entry has a non-empty label and dialect", () => {
		for (const e of DB_TYPE_MANIFEST) {
			assert.ok(typeof e.label === "string" && e.label.trim() !== "", `${e.dbType}: empty label`);
			assert.ok(typeof e.dialect === "string" && e.dialect.trim() !== "", `${e.dbType}: empty dialect`);
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
	it("order is a unique number", () => {
		const orders = new Set();
		for (const e of DB_TYPE_MANIFEST) {
			assert.equal(typeof e.order, "number", `${e.dbType}: order not number`);
			assert.equal(orders.has(e.order), false, `duplicate order: ${e.order}`);
			orders.add(e.order);
		}
	});
});

describe("connection-config inference", () => {
	it("postgres → schemas", () => { assert.equal(inferCatalogFamily("postgres"), "schemas"); });
	it("mysql → schemas", () => { assert.equal(inferCatalogFamily("mysql"), "schemas"); });
	it("sqlite → flat", () => { assert.equal(inferCatalogFamily("sqlite"), "flat"); });
	it("mongodb → flat (bridge)", () => { assert.equal(inferCatalogFamily("mongodb"), "flat"); });
	it("unknown dbType → flat fallback", () => { assert.equal(inferCatalogFamily("bogusdb"), "flat"); });
	it("postgres defaultPort 5432", () => { assert.equal(defaultPortFor("postgres"), 5432); });
	it("unknown defaultPort 0", () => { assert.equal(defaultPortFor("bogusdb"), 0); });
	it("cloudflare-d1 port 0 (file-based)", () => { assert.equal(defaultPortFor("cloudflare-d1"), 0); });
	it("findDbType returns undefined for unknown", () => { assert.equal(findDbType("bogusdb"), undefined); });
	it("unknown runtimeMode falls back to native", () => { assert.equal(runtimeModeFor("bogusdb"), "native"); });
	it("supportsExplain/supportsTableDataEdit default false for unknown", () => {
		assert.equal(supportsExplain("bogusdb"), false);
		assert.equal(supportsTableDataEdit("bogusdb"), false);
	});
	it("sqlite is directly executable but not schema-aware", () => {
		const sqlite = findDbType("sqlite");
		assert.ok(sqlite);
		assert.equal(sqlite.schemaAware, false);
	});
});
