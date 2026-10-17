/**
 * 审查发现（finding）的领域模型：字段归一化、稳定标识、计数、按文件分组与过滤。
 *
 * 词表严格对齐 alibaba/open-code-review：
 *   severity  critical | high | medium | low          （非法值 → low）
 *   category  bug | security | performance | maintainability | test | style | documentation | other
 *                                                     （非法值 → other）
 * 归一化规则抄自 ocr 的 internal/tool/code_comment.go:179-190，保证两边同义——
 * 面板上看到的级别就是 ocr 认定级别，不再自造一套 major/minor/info。
 *
 * 两种输入形态都要吃：
 *   delegate 上报（code_review_report）  { file, line, severity, message, rule }
 *   ocr 托管输出（review --format json）  { path, content, start_line, end_line,
 *                                           existing_code, suggestion_code, category, severity }
 * 历史记录里还留着旧的 major/minor/info，读取时映射成新词表，不丢数据。
 */

export type ReviewSeverity = "critical" | "high" | "medium" | "low";

export type ReviewCategory =
	| "bug"
	| "security"
	| "performance"
	| "maintainability"
	| "test"
	| "style"
	| "documentation"
	| "other";

/** 由用户标记的处置状态；`null` 表示未标记。只影响面板视图，不改审查结论。 */
export type FindingMark = "fixed" | "ignored";

export const SEVERITY_ORDER: readonly ReviewSeverity[] = ["critical", "high", "medium", "low"];

export const CATEGORY_ORDER: readonly ReviewCategory[] = [
	"bug",
	"security",
	"performance",
	"maintainability",
	"test",
	"style",
	"documentation",
	"other",
];

export interface ReviewFinding {
	/** 稳定标识：跨渲染、跨持久化都指向同一条发现，标记状态挂在它上面。 */
	readonly key: string;
	readonly file: string;
	/** 0 表示没定位到行（面板显示「未定位」而不是 L0）。 */
	readonly line: number;
	readonly endLine: number;
	readonly severity: ReviewSeverity;
	readonly category: ReviewCategory;
	readonly message: string;
	readonly rule?: string;
	readonly existingCode?: string;
	readonly suggestionCode?: string;
}

export interface FileFindings {
	readonly file: string;
	readonly findings: readonly ReviewFinding[];
}

export interface FindingFilters {
	readonly severity: ReviewSeverity | null;
	readonly category: ReviewCategory | null;
	/** 默认 true：修完/认了的发现不该继续占视线。 */
	readonly hideMarked: boolean;
}

export const DEFAULT_FILTERS: FindingFilters = { severity: null, category: null, hideMarked: true };

/** 旧词表 → 新词表。低版本插件写过 major/minor/info，读回来不能变成「未知」。 */
const LEGACY_SEVERITY: Readonly<Record<string, ReviewSeverity>> = {
	critical: "critical",
	high: "high",
	medium: "medium",
	low: "low",
	major: "high",
	minor: "medium",
	info: "low",
};

interface RawFinding {
	file?: unknown;
	path?: unknown;
	line?: unknown;
	start_line?: unknown;
	end_line?: unknown;
	severity?: unknown;
	category?: unknown;
	message?: unknown;
	content?: unknown;
	rule?: unknown;
	existing_code?: unknown;
	suggestion_code?: unknown;
}

function asText(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value : undefined;
}

function asLine(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

export function normalizeSeverity(value: unknown): ReviewSeverity {
	if (typeof value !== "string") return "low";
	return LEGACY_SEVERITY[value.trim().toLowerCase()] ?? "low";
}

export function normalizeCategory(value: unknown): ReviewCategory {
	if (typeof value !== "string") return "other";
	const key = value.trim().toLowerCase();
	return (CATEGORY_ORDER as readonly string[]).includes(key) ? (key as ReviewCategory) : "other";
}

/** djb2：只用来做去重键，不需要抗碰撞强度。带前缀便于排查。 */
function findingKey(file: string, line: number, message: string): string {
	const seed = `${file}\u0000${line}\u0000${message}`;
	let hash = 5381;
	for (let i = 0; i < seed.length; i += 1) hash = (hash * 33) ^ seed.charCodeAt(i);
	return `${file}:${line}:${(hash >>> 0).toString(36)}`;
}

export function normalizeFinding(raw: unknown): ReviewFinding | null {
	if (typeof raw !== "object" || raw === null) return null;
	const item = raw as RawFinding;
	const file = asText(item.file) ?? asText(item.path);
	const message = asText(item.message) ?? asText(item.content);
	if (!file || !message) return null;
	const line = asLine(item.line) || asLine(item.start_line);
	const endLine = Math.max(line, asLine(item.end_line));
	const existingCode = asText(item.existing_code);
	const suggestionCode = asText(item.suggestion_code);
	const rule = asText(item.rule);
	return {
		key: findingKey(file, line, message),
		file,
		line,
		endLine,
		severity: normalizeSeverity(item.severity),
		category: normalizeCategory(item.category),
		message,
		...(rule ? { rule } : {}),
		...(existingCode ? { existingCode: existingCode.replace(/\s+$/, "") } : {}),
		...(suggestionCode ? { suggestionCode: suggestionCode.replace(/\s+$/, "") } : {}),
	};
}

/** 归一化整批发现：丢掉不合格条目，按 key 去重（同一条被重复上报时只留第一条）。 */
export function normalizeFindings(raw: unknown): ReviewFinding[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: ReviewFinding[] = [];
	for (const item of raw) {
		const finding = normalizeFinding(item);
		if (!finding || seen.has(finding.key)) continue;
		seen.add(finding.key);
		out.push(finding);
	}
	return out;
}

function emptyCounts<T extends string>(order: readonly T[]): Record<T, number> {
	return Object.fromEntries(order.map((key) => [key, 0])) as Record<T, number>;
}

export function countBySeverity(findings: readonly ReviewFinding[]): Record<ReviewSeverity, number> {
	const counts = emptyCounts(SEVERITY_ORDER);
	for (const finding of findings) counts[finding.severity] += 1;
	return counts;
}

export function countByCategory(findings: readonly ReviewFinding[]): Record<ReviewCategory, number> {
	const counts = emptyCounts(CATEGORY_ORDER);
	for (const finding of findings) counts[finding.category] += 1;
	return counts;
}

export function countFiles(findings: readonly ReviewFinding[]): number {
	return new Set(findings.map((finding) => finding.file)).size;
}

/** 一组发现里最严重的级别：文件分组标题上的徽章用。 */
export function worstSeverity(findings: readonly ReviewFinding[]): ReviewSeverity | null {
	for (const severity of SEVERITY_ORDER) {
		if (findings.some((finding) => finding.severity === severity)) return severity;
	}
	return null;
}

/**
 * 按文件分组：文件名字典序，文件内按行号升序，未定位（line 0）的排在文件末尾。
 * 排序固定，避免同一份结果两次打开顺序不同。
 */
export function groupByFile(findings: readonly ReviewFinding[]): FileFindings[] {
	const grouped = new Map<string, ReviewFinding[]>();
	for (const finding of findings) {
		const list = grouped.get(finding.file);
		if (list) list.push(finding);
		else grouped.set(finding.file, [finding]);
	}
	return [...grouped.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([file, list]) => ({
			file,
			findings: [...list].sort((a, b) => (a.line || Number.MAX_SAFE_INTEGER) - (b.line || Number.MAX_SAFE_INTEGER)),
		}));
}

/** 过滤是纯函数：视图层只负责把 filters / marks 传进来，方便直接测。 */
export function filterFindings(
	findings: readonly ReviewFinding[],
	filters: FindingFilters,
	marks: Readonly<Record<string, FindingMark>> = {},
): ReviewFinding[] {
	return findings.filter((finding) => {
		if (filters.severity && finding.severity !== filters.severity) return false;
		if (filters.category && finding.category !== filters.category) return false;
		if (filters.hideMarked && marks[finding.key]) return false;
		return true;
	});
}

/** 已标记条数（面板上的「已隐藏 N 条」）。 */
export function countMarked(
	findings: readonly ReviewFinding[],
	marks: Readonly<Record<string, FindingMark>>,
): number {
	return findings.filter((finding) => Boolean(marks[finding.key])).length;
}
