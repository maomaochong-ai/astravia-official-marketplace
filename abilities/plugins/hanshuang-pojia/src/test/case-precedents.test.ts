import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	findPrecedent,
	precedentDoc,
	rankPrecedents,
	renderPrecedentIndex,
	SHIPPED_PRECEDENTS,
} from "../domain/case/precedents";
import { parseAuthStatus, parseNetworkProfile, assessReadiness, CASE_PRESETS } from "../domain/case/contract";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const casesDir = join(pluginRoot, "cases");
const docsDir = join(pluginRoot, "src/content/docs");

const walk = (dir: string, base = dir): string[] =>
	readdirSync(dir).flatMap(entry => {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) return walk(full, base);
		return [full.slice(base.length + 1)];
	});

describe("shipped precedent packages", () => {
	it("ships one entry per directory under cases/", () => {
		const dirs = readdirSync(casesDir)
			.filter(entry => statSync(join(casesDir, entry)).isDirectory())
			.sort();
		// 这条只会在一种情况下红：目录写好了，生成物没跟上。直接把差额和补救命令说出来。
		const shipped = SHIPPED_PRECEDENTS.map(precedent => precedent.slug);
		const ungenerated = dirs.filter(slug => !shipped.includes(slug));
		const orphaned = shipped.filter(slug => !dirs.includes(slug));
		expect(
			{ ungenerated, orphaned },
			"run `npm run sync:precedents` after adding or removing a package under cases/",
		).toEqual({ ungenerated: [], orphaned: [] });
		expect(shipped).toEqual(dirs);
	});

	it("lists every package in the cases/ index", () => {
		// 索引表格是唯一的人工入口：包落盘了但没列进去，等于只有 search_cases 能找到它。
		const index = readFileSync(join(casesDir, "README.md"), "utf8");
		const missing = SHIPPED_PRECEDENTS.map(precedent => precedent.slug).filter(
			slug => !index.includes(`](${slug}/README.md)`),
		);
		expect(missing, "add a table row in cases/README.md for each new package").toEqual([]);
	});

	it("opens with the four documents every precedent is read through", () => {
		for (const precedent of SHIPPED_PRECEDENTS) {
			// 顺序是阅读协议的一部分：前四份固定，案例专属文档追加在后面。
			expect(precedent.docs.slice(0, 4).map(doc => doc.id)).toEqual([
				"README.md",
				"scope.md",
				"workitems.md",
				"docs/method.md",
			]);
			for (const doc of precedent.docs) {
				expect(doc.text.trim().length, `${precedent.slug}/${doc.id}`).toBeGreaterThan(200);
			}
		}
	});

	it("points a derived package at the case study it was written from", () => {
		for (const precedent of SHIPPED_PRECEDENTS) {
			for (const id of precedent.caseDocs) {
				expect(existsSync(join(docsDir, `${id}.md`)), `${precedent.slug} → ${id}`).toBe(true);
			}
			// 摘要必须能追到原文：只写转述、不留指针的先例不算语料。
			if (precedent.source) {
				expect(precedent.caseDocs.length, `${precedent.slug} cites ${precedent.source.entry}`).toBeGreaterThan(0);
			}
		}
	});

	it("cites only field-journal documents that exist", () => {
		// 生成器已经拦了一次；测试再拦一次，因为「凭记忆写文档 id」是本仓库最常见的假引用。
		for (const precedent of SHIPPED_PRECEDENTS) {
			expect(precedent.fieldNotes.length).toBeGreaterThan(0);
			for (const id of precedent.fieldNotes) {
				expect(existsSync(join(docsDir, `${id}.md`)), `${precedent.slug} cites ${id}`).toBe(true);
			}
		}
	});

	it("starts from a real preset and an unclaimed authorisation", () => {
		const presetIds = CASE_PRESETS.map(preset => preset.id);
		for (const precedent of SHIPPED_PRECEDENTS) {
			expect(presetIds).toContain(precedent.preset);
			const scope = precedentDoc(precedent, "scope.md") ?? "";
			// 随包语料不是操作者的授权：复制后必须重跑 init_task 记录自己的 scope。
			expect(scope).toContain("- status: pending");
			expect(scope).toContain("- ready_for_act: false");
			expect(parseAuthStatus(/^- status: (\S+)$/m.exec(scope)?.[1])).toBe("pending");
		}
	});

	it("declares the network profile its preset implies", () => {
		for (const precedent of SHIPPED_PRECEDENTS) {
			const scope = precedentDoc(precedent, "scope.md") ?? "";
			expect(parseNetworkProfile(/^- mode: (\S+)$/m.exec(scope)?.[1])).toBe("offline");
			// 离线档案必须有离线样本才允许开工：现状是 pending，所以一定被门拦住。
			const readiness = assessReadiness({ authStatus: "pending", networkProfile: "offline", inScope: [] });
			expect(readiness.ready).toBe(false);
			expect(readiness.blockers.length).toBeGreaterThan(0);
		}
	});

	it("keeps the corpus method-level: no executables, archives or sample bytes", () => {
		const files = walk(casesDir);
		const forbidden = files.filter(file => /\.(exe|dll|so|dylib|bin|apk|zip|pkg|jar|pyc|db|msi|scr|png|jpg|pdf)$/i.test(file));
		expect(forbidden).toEqual([]);
		expect(files.some(file => file.endsWith("case.json"))).toBe(true);
	});
});

describe("precedent search", () => {
	it("ranks by the signal it was written for", () => {
		expect(rankPrecedents("pinning")[0]?.precedent.slug).toBe("android-ssl-pin-bypass");
		expect(rankPrecedents("license")[0]?.precedent.slug).toBe("client-auth-gate");
		expect(rankPrecedents("upx")[0]?.precedent.slug).toBe("elf-packed-loader");
		expect(rankPrecedents("webpack")[0]?.precedent.slug).toBe("js-sign-chain");
	});

	it("matches the method text, not only the signal list", () => {
		const hits = rankPrecedents("handshake");
		expect(hits.length).toBeGreaterThan(0);
		expect(hits[0]?.reasons.join(" ")).toContain("method text mentions");
	});

	it("returns nothing for a token no precedent covers, and says what exists", () => {
		expect(rankPrecedents("kerberoasting")).toEqual([]);
		const rendered = renderPrecedentIndex([], "kerberoasting");
		expect(rendered).toContain('No shipped precedent matches "kerberoasting".');
		expect(rendered).toContain("elf-packed-loader");
	});

	it("lists every package without a query, deterministically", () => {
		// 默认 limit 只服务于检索；列全部时显式要够，免得增包后这条断言静默少一项。
		const listed = rankPrecedents(undefined, SHIPPED_PRECEDENTS.length);
		expect(listed).toHaveLength(SHIPPED_PRECEDENTS.length);
		expect(listed.map(hit => hit.precedent.slug)).toEqual([...SHIPPED_PRECEDENTS.map(p => p.slug)].sort());
	});

	it("honours the limit", () => {
		expect(rankPrecedents(undefined, 2)).toHaveLength(2);
	});

	it("looks a package up by slug without inventing one", () => {
		expect(findPrecedent("js-sign-chain")?.title).toContain("signature");
		expect(findPrecedent("no-such-precedent")).toBeUndefined();
	});
});
