/**
 * 先例包的单一校验入口。
 *
 * 生成器（scripts/sync-precedents.mjs）与单包检查器
 * （scripts/check-precedent-package.mjs）都走这里：整树还没写完时，
 * 作者也要能只校验自己那一个目录。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const CASE_PRESETS = ["offline-sample", "ctf-public", "own-system"];

/**
 * 每份先例都必须能被人按顺序读完的四份文档。
 * 之后的文档是案例专属的深读材料（补丁全表、算法、脚本说明），
 * 允许追加，但只追加在第四份之后 —— 顺序本身是阅读协议的一部分。
 */
export const CANONICAL_DOCS = ["README.md", "scope.md", "workitems.md", "docs/method.md"];

/** 先例包不得携带样本与制品；只收文本。 */
const FORBIDDEN_FILE = /\.(exe|dll|so|dylib|bin|apk|apks|aab|ipa|zip|7z|rar|pkg|jar|class|pyc|db|img|sys|o|a|lib|msi|scr|png|jpg|jpeg|gif|webp|ico|pdf)$/i;

/** 绝对路径会把作者机器的目录结构带进随包语料。 */
const ABSOLUTE_PATH = /(?:[A-Za-z]:\\Users\\|\/Users\/|\/home\/[a-z])/;

export function precedentDirs(casesDir) {
	if (!existsSync(casesDir)) throw new Error(`cases directory not found: ${casesDir}`);
	return readdirSync(casesDir)
		.filter(entry => statSync(join(casesDir, entry)).isDirectory())
		.sort();
}

function readJson(path, problems) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		problems.push(`case.json is not readable JSON: ${error.message}`);
		return undefined;
	}
}

function walkFiles(dir) {
	return readdirSync(dir).flatMap(entry => {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) return walkFiles(full);
		return [full];
	});
}

/** 校验一个先例目录，返回问题清单（空数组即通过）。 */
export function checkPackage({ casesDir, docsDir, dir }) {
	const problems = [];
	const dirPath = join(casesDir, dir);
	const meta = readJson(join(dirPath, "case.json"), problems);
	if (!meta) return { meta, problems };

	if (meta.schemaVersion !== 1) problems.push(`schemaVersion must be 1 (got ${meta.schemaVersion})`);
	if (meta.slug !== dir) problems.push(`slug "${meta.slug}" does not match directory "${dir}"`);
	for (const key of ["title", "summary"]) {
		if (typeof meta[key] !== "string" || meta[key].trim() === "") problems.push(`${key} is required`);
	}
	if (!Array.isArray(meta.signals) || meta.signals.length === 0) problems.push("signals must be a non-empty array");
	if (!CASE_PRESETS.includes(meta.preset)) problems.push(`preset "${meta.preset}" is not one of ${CASE_PRESETS.join(", ")}`);
	if (!Array.isArray(meta.fieldNotes)) problems.push("fieldNotes must be an array");

	const docs = Array.isArray(meta.docs) ? meta.docs : [];
	if (docs.length === 0) problems.push("docs must be a non-empty array");
	if (docs.length > 0 && !CANONICAL_DOCS.every((id, index) => docs[index] === id)) {
		problems.push(`docs must start with ${CANONICAL_DOCS.join(", ")} in that order`);
	}
	if (new Set(docs).size !== docs.length) problems.push("docs lists the same file twice");

	// 引用必须真的存在：先例包不得凭记忆写文档 id。
	for (const id of meta.fieldNotes ?? []) {
		if (!existsSync(join(docsDir, `${id}.md`))) problems.push(`fieldNotes id has no document: ${id}`);
	}
	for (const id of docs) {
		const full = join(dirPath, id);
		if (!existsSync(full)) {
			problems.push(`doc listed but missing: ${id}`);
			continue;
		}
		const text = readFileSync(full, "utf8");
		if (text.trim().length <= 200) problems.push(`doc is too thin to be worth reading (${id})`);
		if (ABSOLUTE_PATH.test(text)) problems.push(`doc leaks an absolute user path (${id})`);
	}

	// 深读材料：案例原文放进文档库（惰性加载），包里只留指针。
	// 指针指到一篇空壳等于没写，所以这里把「存在」和「值得读」分开校验。
	const caseDocs = meta.caseDocs ?? [];
	if (!Array.isArray(caseDocs)) problems.push("caseDocs must be an array when present");
	for (const id of Array.isArray(caseDocs) ? caseDocs : []) {
		const full = join(docsDir, `${id}.md`);
		if (!existsSync(full)) {
			problems.push(`caseDocs id has no document: ${id}`);
			continue;
		}
		const text = readFileSync(full, "utf8");
		if (text.trim().length <= 1000) problems.push(`case study is too thin to carry the case (${id})`);
		if (!/^#\s+\S/m.test(text)) problems.push(`case study has no H1 title (${id})`);
		if (ABSOLUTE_PATH.test(text)) problems.push(`case study leaks an absolute user path (${id})`);
	}

	// 溯源：案例语料必须能追回上游目录，且必须带深读材料，否则它就是一篇转述。
	const source = meta.source;
	if (source !== undefined) {
		if (typeof source !== "object" || source === null || Array.isArray(source)) problems.push("source must be an object");
		else {
			for (const key of ["library", "entry"]) {
				if (typeof source[key] !== "string" || source[key].trim() === "") problems.push(`source.${key} is required`);
			}
		}
		if (caseDocs.length === 0) problems.push("a derived package must point at its caseDocs");
	}

	for (const file of walkFiles(dirPath)) {
		const rel = relative(dirPath, file).split(sep).join("/");
		if (FORBIDDEN_FILE.test(rel)) problems.push(`precedent packages carry text only, found: ${rel}`);
	}

	return { meta, problems };
}

/** 读出一个先例包并规整成随包结构。 */
export function readPackage({ casesDir, docsDir, dir }) {
	const { meta, problems } = checkPackage({ casesDir, docsDir, dir });
	if (problems.length > 0) {
		const error = new Error(`cases/${dir}/case.json is invalid:\n${problems.map(line => `  - ${line}`).join("\n")}`);
		error.problems = problems;
		throw error;
	}
	return {
		slug: meta.slug,
		title: meta.title,
		summary: meta.summary,
		signals: meta.signals,
		preset: meta.preset,
		fieldNotes: meta.fieldNotes,
		caseDocs: meta.caseDocs ?? [],
		...(meta.source ? { source: meta.source } : {}),
		docs: meta.docs.map(id => ({ id, text: readFileSync(join(casesDir, dir, id), "utf8") })),
	};
}
