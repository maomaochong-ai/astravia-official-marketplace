/**
 * 版本号一致性守卫。
 *
 * 发版要求 5 处版本逐字一致（见 src/domain/plugin-version.ts 的注释与仓库手册）：
 * plugin.json / ability.json / package.json / domain 常量，以及市场源里的条目版本。
 * 任何一处漏改都会让 UI 显示旧版本，或让 `node scripts/marketplace.mjs check` 直接报
 * Presentation identity mismatch —— 所以这里把它钉成测试，而不是靠人记得。
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PLUGIN_VERSION } from "../domain/plugin-version.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..", "..");
const MARKETPLACE_SOURCE = resolve(PLUGIN_ROOT, "..", "..", "..", ".astravia", "marketplace.source.json");

/** 读一份 JSON 文件。 */
function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

describe("版本号一致性", () => {
	it("plugin.json / ability.json / package.json 与 domain 常量逐字一致", () => {
		const descriptor = readJson(join(PLUGIN_ROOT, "plugin.json"));
		const presentation = readJson(join(PLUGIN_ROOT, "ability.json"));
		const manifest = readJson(join(PLUGIN_ROOT, "package.json"));

		assert.equal(descriptor.version, PLUGIN_VERSION, "plugin.json 的版本与 PLUGIN_VERSION 不一致");
		assert.equal(presentation.version, PLUGIN_VERSION, "ability.json 的版本与 PLUGIN_VERSION 不一致");
		assert.equal(manifest.version, PLUGIN_VERSION, "package.json 的版本与 PLUGIN_VERSION 不一致");
	});

	it("市场源里 dbx-pro 条目的版本与插件版本一致", (t) => {
		if (!existsSync(MARKETPLACE_SOURCE)) {
			t.skip("不在仓库内运行（找不到 .astravia/marketplace.source.json）");
			return;
		}
		const catalog = readJson(MARKETPLACE_SOURCE);
		const entry = catalog.abilities.find((item) => item.slug === "dbx-pro");
		assert.ok(entry, "市场源里找不到 dbx-pro 条目");
		assert.equal(entry.version, PLUGIN_VERSION, "市场源条目的版本与 PLUGIN_VERSION 不一致");
		assert.equal(entry.type, "plugin");
	});
});
