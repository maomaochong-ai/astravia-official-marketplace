/**
 * 先例包的单一校验入口。
 *
 * 生成器（scripts/sync-precedents.mjs）与单包检查器
 * （scripts/check-precedent-package.mjs）都走这里：整树还没写完时，
 * 作者也要能只校验自己那一个目录。
 */
import { spawnSync } from "node:child_process";
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

export const TOOL_RUNTIMES = ["python", "powershell", "node"];

/** 共享原语目录：不是先例包，不参与排名，随 scaffold 一起写出。 */
export const SHARED_DIR = "_shared";

/** 深读材料的下限：一篇撑不起「工程现场」的复盘等于没有。 */
const CASE_DOC_MIN_CHARS = 3000;

/** 工具脚本下限：挡住空壳与只写了 docstring 的占位文件。 */
const TOOL_MIN_BYTES = 400;

export function precedentDirs(casesDir) {
	if (!existsSync(casesDir)) throw new Error(`cases directory not found: ${casesDir}`);
	return readdirSync(casesDir)
		.filter(entry => !entry.startsWith("_"))
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
		if (statSync(full).isDirectory()) {
			// 解释器缓存不是语料：跑过一次自检就会生成，不该被当成包内容。
			if (entry === "__pycache__" || entry === ".pytest_cache") return [];
			return walkFiles(full);
		}
		return [full];
	});
}

/**
 * 工具清单校验：一个先例包如果不携带能跑的东西，它就只是一篇备忘录。
 *
 * 这里只做静态检查（存在、形状、纯净）。实际执行留给 runToolSelfTest，
 * 因为它要启动进程，而生成路径必须保持纯函数。
 */
const RUNTIME_EXTENSION = { python: [".py"], powershell: [".ps1"], node: [".js"] };
const TOOL_ID = /^[a-z][a-z0-9_]*$/;
const ASCII_ONLY = /^[\x00-\x7F]*$/;

function checkTools({ dir, dirPath }) {
	const problems = [];
	const toolsDir = join(dirPath, "tools");
	if (!existsSync(toolsDir)) {
		problems.push("tools/manifest.json is required: a precedent without a runnable tool is a memo");
		return problems;
	}
	const manifestPath = join(toolsDir, "manifest.json");
	if (!existsSync(manifestPath)) {
		problems.push("tools/manifest.json is missing");
		return problems;
	}
	let manifest;
	try {
		manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	} catch (error) {
		problems.push(`tools/manifest.json is not readable JSON: ${error.message}`);
		return problems;
	}
	if (manifest.schemaVersion !== 1) problems.push(`tools/manifest.json schemaVersion must be 1 (got ${manifest.schemaVersion})`);
	if (manifest.slug !== dir) problems.push(`tools/manifest.json slug "${manifest.slug}" does not match directory "${dir}"`);
	if (!TOOL_RUNTIMES.includes(manifest.runtime)) {
		problems.push(`tools/manifest.json runtime must be one of ${TOOL_RUNTIMES.join(", ")}`);
	}
	if (!Array.isArray(manifest.platforms) || manifest.platforms.length === 0) {
		problems.push("tools/manifest.json platforms must be a non-empty array");
	}
	if (!Array.isArray(manifest.tools) || manifest.tools.length === 0) {
		problems.push("tools/manifest.json must list at least one tool");
		return problems;
	}

	const allowed = RUNTIME_EXTENSION[manifest.runtime] ?? [];
	const seen = new Set();
	for (const tool of manifest.tools) {
		const label = tool && tool.id ? tool.id : "<no id>";
		if (!tool || typeof tool !== "object") {
			problems.push("tools[] entries must be objects");
			continue;
		}
		if (typeof tool.id !== "string" || !TOOL_ID.test(tool.id)) problems.push(`tool id must be lowercase snake_case: ${label}`);
		if (seen.has(tool.id)) problems.push(`duplicate tool id: ${label}`);
		seen.add(tool.id);
		if (typeof tool.purpose !== "string" || tool.purpose.trim().length < 20) {
			problems.push(`tool purpose must say what it does (>=20 chars): ${label}`);
		}
		if (!Array.isArray(tool.args)) problems.push(`tool args must be an array: ${label}`);
		if (typeof tool.expect !== "string" || tool.expect.trim() === "") problems.push(`tool expect is required: ${label}`);
		if (typeof tool.selfTest !== "string" || !tool.selfTest.includes("--self-test")) {
			problems.push(`tool selfTest command must pass --self-test: ${label}`);
		}
		if (typeof tool.entry !== "string" || tool.entry === "") {
			problems.push(`tool entry is required: ${label}`);
			continue;
		}
		if (allowed.length > 0 && !allowed.some(extension => tool.entry.endsWith(extension))) {
			problems.push(`tool entry must be ${allowed.join("/")} for runtime ${manifest.runtime}: ${label}`);
		}
		const entryPath = join(toolsDir, tool.entry);
		if (!existsSync(entryPath)) {
			problems.push(`tool entry does not exist: ${tool.entry}`);
			continue;
		}
		const text = readFileSync(entryPath, "utf8");
		if (text.length < TOOL_MIN_BYTES) problems.push(`tool entry is a stub (${text.length} bytes): ${tool.entry}`);
		if (!ASCII_ONLY.test(text)) problems.push(`tool entry must stay ASCII so it runs anywhere: ${tool.entry}`);
		if (ABSOLUTE_PATH.test(text)) problems.push(`tool entry leaks an absolute user path: ${tool.entry}`);
		if (!text.includes("--self-test")) problems.push(`tool entry does not implement --self-test: ${tool.entry}`);
	}
	return problems;
}

/** 共享原语目录：只允许 Python 源码，随 scaffold 一起写出。 */
export function checkSharedKit(casesDir) {
	const problems = [];
	const sharedDir = join(casesDir, SHARED_DIR);
	if (!existsSync(sharedDir)) return ["cases/_shared/hpkit is missing: tools import it at run time"];
	for (const file of walkFiles(sharedDir)) {
		const rel = relative(sharedDir, file).split(sep).join("/");
		if (FORBIDDEN_FILE.test(rel)) problems.push(`shared kit carries a binary: ${rel}`);
		if (!rel.endsWith(".py")) problems.push(`shared kit must be Python only, found: ${rel}`);
		const text = readFileSync(file, "utf8");
		if (!ASCII_ONLY.test(text)) problems.push(`shared kit file must stay ASCII: ${rel}`);
		if (ABSOLUTE_PATH.test(text)) problems.push(`shared kit file leaks an absolute user path: ${rel}`);
	}
	if (!existsSync(join(sharedDir, "hpkit", "__init__.py"))) problems.push("cases/_shared/hpkit/__init__.py is missing");
	return problems;
}

/**
 * 跑一个工具的 --self-test。这是「能跑」唯一的硬证据：
 * 没有它，几个月后没人知道这些脚本还能不能用。
 */
export function runToolSelfTest({ dirPath, manifest, tool, timeout = 60000 }) {
	const toolsDir = join(dirPath, "tools");
	const interpreter = manifest.runtime === "python" ? process.env.ASTRAVIA_PYTHON ?? "python3" : manifest.runtime === "node" ? process.execPath : "pwsh";
	const result = spawnSync(interpreter, [join(toolsDir, tool.entry), "--self-test"], {
		cwd: toolsDir,
		encoding: "utf8",
		timeout,
		maxBuffer: 4 * 1024 * 1024,
	});
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
	return { ok: result.status === 0, status: result.status, output, error: result.error };
}

/** 校验一个先例目录，返回问题清单（空数组即通过）。 */
export function checkPackage({ casesDir, docsDir, dir, runTools = false }) {
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
	// 每个包都要有深读材料：只有方法摘要的包就是用户说的「草图」。
	if (Array.isArray(caseDocs) && caseDocs.length === 0) problems.push("caseDocs is required: a method summary without a case study is a sketch");
	for (const id of Array.isArray(caseDocs) ? caseDocs : []) {
		const full = join(docsDir, `${id}.md`);
		if (!existsSync(full)) {
			problems.push(`caseDocs id has no document: ${id}`);
			continue;
		}
		const text = readFileSync(full, "utf8");
		if (text.trim().length <= CASE_DOC_MIN_CHARS) problems.push(`case study is too thin to carry the case (${id}: ${text.trim().length} chars, need > ${CASE_DOC_MIN_CHARS})`);
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

	problems.push(...checkTools({ dir, dirPath }));

	if (runTools) {
		const manifestPath = join(dirPath, "tools", "manifest.json");
		if (existsSync(manifestPath)) {
			const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
			for (const tool of manifest.tools ?? []) {
				if (typeof tool.entry !== "string" || !existsSync(join(dirPath, "tools", tool.entry))) continue;
				const outcome = runToolSelfTest({ dirPath, manifest, tool });
				if (!outcome.ok) {
					problems.push(
						`tool self test failed (${tool.entry}, exit ${outcome.status}): ${outcome.output.split("\n").slice(-3).join(" / ")}`,
					);
				}
			}
		}
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
		tools: readToolManifest(join(casesDir, dir)),
		docs: meta.docs.map(id => ({ id, text: readFileSync(join(casesDir, dir, id), "utf8") })),
	};
}

/** 工具清单规整成随包结构：只带元数据，脚本本体由资源层分发。 */
export function readToolManifest(dirPath) {
	const manifestPath = join(dirPath, "tools", "manifest.json");
	if (!existsSync(manifestPath)) return { runtime: "python", platforms: [], tools: [] };
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	return {
		runtime: manifest.runtime,
		platforms: manifest.platforms ?? [],
		tools: (manifest.tools ?? []).map(tool => ({
			id: tool.id,
			entry: tool.entry,
			purpose: tool.purpose,
			args: tool.args ?? [],
			expect: tool.expect,
		})),
	};
}
