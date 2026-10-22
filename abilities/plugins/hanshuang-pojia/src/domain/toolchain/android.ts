/**
 * Android decompilation through jadx / apktool, and source-tree searching for
 * the unpacked result.
 *
 * jadx writes a Java project and apktool writes smali plus decoded resources;
 * both are async, slow and produce far more text than a conversation needs, so
 * the plan returns the output directory and only the head of the log. The
 * searching half runs on the plugin's own `fs`, not on a process.
 */
import type { CommandResult, Invocation } from "./catalog";
import { joinPath, parentOf, stemOf } from "./paths";

export type { Invocation } from "./catalog";

export type AndroidOperation = "decompile" | "unpack" | "smali_search";

export interface AndroidRequest {
	operation: AndroidOperation;
	/** APK / DEX / JAR path, required by `decompile` and `unpack`. */
	apkPath?: string;
	/** Unpacked tree to search, required by `smali_search`. */
	directory?: string;
	outputDir?: string;
	/** jadx `--deobf`: restore readable names where the mapping allows it. */
	deobfuscate?: boolean;
	/** apktool `-s`: skip smali, extract resources only. */
	noSources?: boolean;
	pattern?: string;
	caseSensitive?: boolean;
	limit?: number;
}

export interface AndroidPlan {
	operation: AndroidOperation;
	invocation: Invocation;
	outputDir: string;
	render(results: readonly CommandResult[]): string;
}

export const JADX_TIMEOUT = 600_000;
export const APKTOOL_TIMEOUT = 600_000;
export const DEFAULT_HITS = 50;
export const MAX_HITS = 500;

const LOG_CHARS = 600;
/** Sibling directory for build output, so nothing lands inside the sample folder tree. */
export function defaultOutputDir(apkPath: string, kind: "jadx" | "apktool"): string {
	return joinPath(parentOf(apkPath), `${stemOf(apkPath)}_${kind === "jadx" ? "jadx_src" : "apktool"}`);
}

/**
 * Both decompilers write a directory and then say almost nothing useful, so the answer is
 * the same shape twice: exit code, where the tree landed, and a bounded log tail.
 */
function renderDecompiler(
	tool: string,
	outputDir: string,
	success: readonly string[],
	results: readonly CommandResult[],
): string {
	const first = results[0];
	const log = [first?.stdout ?? "", first?.stderr ?? ""].join("\n").trim().slice(0, LOG_CHARS);
	if (first && first.exitCode !== 0) {
		return `${tool} failed (exit ${first.exitCode ?? "signal"}).\nOutput directory: ${outputDir}\nLog: ${log || "(no output)"}`;
	}
	return [...success, `Log: ${log || "(quiet)"}`].join("\n");
}

export function planAndroid(request: AndroidRequest): AndroidPlan {
	const apkPath = (request.apkPath ?? "").trim();
	if (request.operation === "smali_search") {
		throw new Error("smali_search runs on the plugin's fs, not on an external process");
	}
	if (!apkPath) throw new Error("apk_path is required for this operation");

	const outputDir = (request.outputDir ?? "").trim() || defaultOutputDir(apkPath, request.operation === "decompile" ? "jadx" : "apktool");

	if (request.operation === "decompile") {
		const args = ["-d", outputDir];
		if (request.deobfuscate !== false) args.push("--deobf");
		args.push(apkPath);
		return {
			operation: request.operation,
			invocation: { file: "jadx", args, timeoutMs: JADX_TIMEOUT },
			outputDir,
			render: results =>
				renderDecompiler(
					"jadx",
					outputDir,
					[
						"jadx finished. Read the Java sources under",
						`  ${outputDir}/sources/`,
						"The tree is large: search it with operation=smali_search instead of reading files one by one.",
					],
					results,
				),
		};
	}

	// No `-f`: apktool's force flag deletes whatever already sits at the destination, and apktool
	// refuses an existing one on its own. Never let a re-run wipe a directory the user owns.
	const args = ["d"];
	if (request.noSources) args.push("-s");
	args.push("-o", outputDir, apkPath);
	return {
		operation: request.operation,
		invocation: { file: "apktool", args, timeoutMs: APKTOOL_TIMEOUT },
		outputDir,
		render: results =>
			renderDecompiler(
				"apktool",
				outputDir,
				[
					"apktool finished.",
					`  AndroidManifest.xml : ${joinPath(outputDir, "AndroidManifest.xml")}`,
					`  resources           : ${joinPath(outputDir, "res")}`,
					request.noSources ? "  smali               : skipped (-s)" : `  smali               : ${joinPath(outputDir, "smali")}`,
				],
				results,
			),
	};
}

export interface SearchEntry {
	path: string;
	relPath: string;
	name: string;
}

/** The subset of `ctx.fs` this search needs, so tests can pass a fake. */
export interface SearchFs {
	listFilesRecursive(root: string): Promise<SearchEntry[]>;
	readFile(filePath: string): Promise<{ content: string }>;
}

export const SEARCH_EXTENSIONS = [".smali", ".java", ".kt", ".xml", ".txt", ".json", ".properties", ".gradle"];
/**
 * Upper bound on one file's content in UTF-16 code units. The host hands us whole
 * strings, so this cannot stop the read — it only stops us splitting a huge file
 * line by line, and `skipped` reports what it cost.
 */
export const MAX_SEARCH_CHARS = 2 * 1024 * 1024;
export const MAX_SEARCH_FILES = 8_000;

export interface SearchHit {
	/** Path relative to the searched directory, exactly as the host lists it. */
	relPath: string;
	line: number;
	text: string;
}

export interface SearchResult {
	hits: SearchHit[];
	scanned: number;
	/** Files skipped for exceeding `MAX_SEARCH_CHARS`; named so a thin result is not mistaken for absence. */
	skipped: number;
	considered: number;
	truncated: boolean;
	/** True when the file cap stopped the walk before the tree ended. */
	fileCapReached: boolean;
}

export async function searchSourceTree(
	fs: SearchFs,
	options: { directory: string; pattern: string; caseSensitive?: boolean; limit?: number },
): Promise<SearchResult> {
	const pattern = options.pattern.trim();
	if (!pattern) throw new Error("pattern is required for smali_search");
	const limit = Math.max(1, Math.min(MAX_HITS, options.limit ?? DEFAULT_HITS));
	const needle = options.caseSensitive ? pattern : pattern.toLowerCase();

	const files = await fs.listFilesRecursive(options.directory);
	const considered = files.filter(file => SEARCH_EXTENSIONS.some(extension => file.name.toLowerCase().endsWith(extension)));
	const capped = considered.slice(0, MAX_SEARCH_FILES);

	const hits: SearchHit[] = [];
	let scanned = 0;
	let skipped = 0;
	let truncated = false;
	for (const file of capped) {
		const text = (await fs.readFile(file.path)).content;
		if (text.length > MAX_SEARCH_CHARS) {
			skipped += 1;
			continue;
		}
		scanned += 1;
		const lines = text.split(/\r?\n/);
		for (let index = 0; index < lines.length; index += 1) {
			const haystack = options.caseSensitive ? lines[index] : lines[index].toLowerCase();
			if (!haystack.includes(needle)) continue;
			if (hits.length >= limit) {
				truncated = true;
				break;
			}
			hits.push({ relPath: file.relPath, line: index + 1, text: lines[index].trim().slice(0, 240) });
		}
		if (truncated) break;
	}

	return {
		hits,
		scanned,
		skipped,
		considered: considered.length,
		truncated,
		fileCapReached: considered.length > MAX_SEARCH_FILES,
	};
}

export function renderSearch(result: SearchResult, pattern: string): string {
	if (result.hits.length === 0) {
		const skipped = result.skipped > 0 ? `, ${result.skipped} skipped as too large` : "";
		return `No matches for ${JSON.stringify(pattern)} in ${result.scanned} scanned file(s) of ${result.considered} candidate(s)${skipped}.`;
	}
	const lines = result.hits.map(hit => `${hit.relPath}:${hit.line}: ${hit.text}`);
	const tail: string[] = [];
	if (result.truncated) tail.push(`... [hit limit reached after ${result.hits.length} matches — raise limit or narrow the pattern]`);
	if (result.fileCapReached) tail.push(`... [walk stopped at ${MAX_SEARCH_FILES} files — search a subdirectory instead]`);
	if (result.skipped > 0) tail.push(`... [${result.skipped} file(s) skipped for exceeding ${MAX_SEARCH_CHARS} characters]`);
	return [`${result.hits.length} match(es) in ${result.scanned} scanned file(s):`, ...lines, ...tail].join("\n");
}
