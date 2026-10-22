/**
 * 目录级批量分诊：一次扫完一个样本目录，给出「哪个最值得先看」的排序表。
 *
 * 上游对应 `seep_auto_triage`，它是一次调用里把整个样本目录跑一遍三级分诊。插件没有
 * 子进程，但分诊本来就跑在自己的 TypeScript 引擎里，所以这里只需要一层目录遍历：
 *
 * - 用宿主的 `listFilesRecursive`（上限 10,000 条，跳过 dot 目录）拿路径，不自己走 fs；
 * - 按扩展名白名单挑候选，其余不读，避免把几十个 README 当二进制解析；
 * - 顺序执行而不是并发：分诊本身是 CPU 密集的同步解析，并发只会把内存顶上去；
 * - 单个文件失败只记一行，不打断整批 —— 坏样本是常态，不是异常。
 *
 * 这一层**不写盘**：批量结果只回给调用方，落盘由用户显式选择（`export_triage_report`）。
 */

import type { PluginFsApi } from "@astravia-org/plugin-sdk";
import { fromBase64 } from "./base64";
import { formatBytes } from "./report/report";
import { triage } from "./triage";
import type { SampleFormat } from "./triage";
import { READ_LIMIT_BYTES } from "./sample-scope";

export interface BatchEntry {
	/** 相对 `root` 的路径，作为报告里的标识。 */
	path: string;
	name: string;
	size: number;
	format: SampleFormat;
	formatLabel: string;
	score: number;
	grade: string;
	findings: number;
	severity: { critical: number; high: number; medium: number; low: number };
	error?: string;
}

export interface BatchResult {
	root: string;
	/** 目录遍历返回的文件总数。 */
	listed: number;
	/** 扩展名命中、准备分诊的数量。 */
	candidates: number;
	/** 超过 32 MiB 读入上限而跳过的数量。 */
	tooLarge: number;
	entries: BatchEntry[];
	warnings: string[];
	truncated: boolean;
	durationMs: number;
}

export interface BatchOptions {
	root: string;
	recursive?: boolean;
	/** 实际分诊的上限，默认 60。 */
	limit?: number;
	/** 只跑 summary 分诊（默认 summary：批量场景要的是排序，不是全文）。 */
	formatFilter?: readonly SampleFormat[];
}

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

const BINARY_EXTENSIONS = new Map<string, SampleFormat>([
	["apk", "apk"],
	["aab", "aab"],
	["ipa", "ipa"],
	["jar", "jar"],
	["zip", "zip"],
	["dex", "dex"],
	["so", "elf"],
	["dylib", "macho"],
	["exe", "pe"],
	["dll", "pe"],
	["sys", "pe"],
	["scr", "pe"],
	["elf", "elf"],
	["bin", "unknown"],
	["img", "unknown"],
]);

function extensionOf(path: string): string {
	const name = path.slice(path.lastIndexOf("/") + 1);
	const dot = name.lastIndexOf(".");
	return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function isDepthOne(relative: string): boolean {
	return !relative.includes("/");
}

function severityCounts(report: Awaited<ReturnType<typeof triage>>): BatchEntry["severity"] {
	const counts = { critical: 0, high: 0, medium: 0, low: 0 };
	for (const finding of report.findings) {
		if (finding.severity === "critical" || finding.severity === "high" || finding.severity === "medium" || finding.severity === "low") counts[finding.severity] += 1;
	}
	return counts;
}

export async function triageDirectory(fs: PluginFsApi, options: BatchOptions): Promise<BatchResult> {
	const started = Date.now();
	const limit = Math.max(1, Math.min(MAX_LIMIT, options.limit ?? DEFAULT_LIMIT));
	const warnings: string[] = [];

	let listed: Awaited<ReturnType<PluginFsApi["listFilesRecursive"]>> = [];
	try {
		listed = await fs.listFilesRecursive(options.root, { ignoredDirectories: ["build", "release"] });
	} catch (error) {
		throw new Error(`cannot list ${options.root}: ${error instanceof Error ? error.message : String(error)}`);
	}

	const filtered = options.formatFilter ? new Set(options.formatFilter) : null;
	const candidates: { path: string; relative: string; format: SampleFormat }[] = [];
	for (const file of listed) {
		const relative = file.relPath.replace(/\\/g, "/");
		if (!options.recursive && !isDepthOne(relative)) continue;
		const mapped = BINARY_EXTENSIONS.get(extensionOf(relative));
		if (!mapped) continue;
		if (filtered && !filtered.has(mapped)) continue;
		candidates.push({ path: file.path, relative, format: mapped });
	}

	candidates.sort((left, right) => left.relative.localeCompare(right.relative));
	const picked = candidates.slice(0, limit);
	const truncated = candidates.length > picked.length;
	if (truncated) warnings.push(`${candidates.length - picked.length} candidate(s) beyond the ${limit}-file limit were not triaged`);

	const entries: BatchEntry[] = [];
	let tooLarge = 0;
	for (const candidate of picked) {
		try {
			const stat = await fs.stat(candidate.path);
			if (!stat) throw new Error("file disappeared before it could be read");
			if (stat.size > READ_LIMIT_BYTES) {
				tooLarge += 1;
				warnings.push(`${candidate.relative} is ${formatBytes(stat.size)}, above the ${formatBytes(READ_LIMIT_BYTES)} read limit; skipped`);
				continue;
			}
			const bytes = fromBase64((await fs.readBinaryFile(candidate.path)).data);
			const report = await triage({ path: candidate.path, name: candidate.relative, bytes }, { mode: "summary" });
			entries.push({
				path: candidate.relative,
				name: report.target.name,
				size: report.target.size,
				format: candidate.format,
				formatLabel: report.target.formatLabel,
				score: report.risk.score,
				grade: report.risk.grade,
				findings: report.findings.length,
				severity: severityCounts(report),
			});
		} catch (error) {
			entries.push({
				path: candidate.relative,
				name: candidate.relative,
				size: 0,
				format: candidate.format,
				formatLabel: "unreadable",
				score: 0,
				grade: "-",
				findings: 0,
				severity: { critical: 0, high: 0, medium: 0, low: 0 },
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// 排序口径：先看等级（E 最差），再看得分，最后按名字稳定输出。
	const order = ["E", "D", "C", "B", "A", "-"];
	entries.sort((left, right) => order.indexOf(left.grade) - order.indexOf(right.grade) || right.score - left.score || left.path.localeCompare(right.path));

	return {
		root: options.root,
		listed: listed.length,
		candidates: candidates.length,
		tooLarge,
		entries,
		warnings: warnings.slice(0, 12),
		truncated,
		durationMs: Date.now() - started,
	};
}

export function renderBatch(result: BatchResult): string {
	const failed = result.entries.filter(entry => entry.error).length;
	const lines = [
		`# batch triage — ${result.root}`,
		`${result.listed} file(s) listed, ${result.candidates} candidate binary/bundle(s), ${result.entries.length} triaged${failed > 0 ? `, ${failed} failed` : ""} in ${result.durationMs} ms.`,
		"",
		"| grade | score | format | size | findings (c/h/m/l) | path |",
		"| --- | --- | --- | --- | --- | --- |",
	];
	for (const entry of result.entries) {
		const findings = `${entry.findings} (${entry.severity.critical}/${entry.severity.high}/${entry.severity.medium}/${entry.severity.low})`;
		lines.push(
			`| ${entry.grade} | ${entry.score} | ${entry.formatLabel} | ${formatBytes(entry.size)} | ${findings} | ${entry.error ? `${entry.path} — ${entry.error}` : entry.path} |`,
		);
	}
	if (result.entries.length === 0) lines.push("| - | - | - | - | - | no binary found under this directory |");

	if (result.warnings.length > 0) {
		lines.push("", "Notes:", ...result.warnings.map(warning => `- ${warning}`));
	}
	lines.push("", "Grades come from the same rule set as triage_binary; open one row with triage_binary or export_triage_report for the full report.");
	return lines.join("\n");
}
