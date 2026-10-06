/**
 * export-file-name —— 导出文件命名（纯函数，可被 node:test 直接导入）。
 *
 * 命名规则（用户指定，优先于 dbx 原生时间戳格式）：
 *   库名_表名_YYYYMMDD_HHmm.扩展名，例如 mydb_orders_20261006_1530.csv
 *
 * - 库名 / 表名缺失（空串 / 非字符串 / sanitize 后为空）则跳过该段；
 *   两段都缺时用 fallback（默认 query-result）兜底，保证文件名永远非空。
 * - 非法文件名字符（Windows / macOS 交集 [<>:"/\\|?*] 与控制字符）统一替换为 _，
 *   连续空白合并，去掉首尾的 . _ 空白 连字符，并摘掉误带的 .sql 后缀（对齐 dbx sanitize）。
 * - 单个名字段最长 120 字符。
 * - 重名不在插件侧去重：saveAs 走宿主原生保存对话框，由用户在系统对话框确认覆盖。
 */

/** 文件名非法字符：Windows 保留字符 + 0x00-0x1F 控制字符。 */
const ILLEGAL_CHAR_RE = /[<>:"/\\|?*\u0000-\u001f]/g;
const WHITESPACE_RE = /\s+/g;
const TRAILING_JUNK_RE = /[._\s-]+$/;
const SQL_SUFFIX_RE = /\.sql$/i;
const MAX_SEGMENT_LENGTH = 120;
export const EXPORT_FILE_NAME_FALLBACK = "query-result";

/** sanitize 单个名字段（库名 / 表名 / fallback）；无法使用时返回空串。 */
export function sanitizeNameSegment(input: unknown): string {
	if (typeof input !== "string") return "";
	const cleaned = input
		.trim()
		.replace(SQL_SUFFIX_RE, "")
		.replace(ILLEGAL_CHAR_RE, "_")
		.replace(WHITESPACE_RE, " ")
		.trim()
		.replace(TRAILING_JUNK_RE, "");
	return cleaned.slice(0, MAX_SEGMENT_LENGTH);
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

/** 紧凑本地时间戳：YYYYMMDD_HHmm（用户指定口径）。 */
export function compactExportTimestamp(date: Date = new Date()): string {
	return (
		String(date.getFullYear()) +
		pad2(date.getMonth() + 1) +
		pad2(date.getDate()) +
		"_" +
		pad2(date.getHours()) +
		pad2(date.getMinutes())
	);
}

export interface ExportFileNameParts {
	/** 数据库名（连接配置的 database）。 */
	database?: string | null;
	/** 表名（表属性选择 / SQL 解析）。 */
	tableName?: string | null;
	/** 两者都缺时的兜底名。 */
	fallback?: string | null;
	/** 注入时间（测试用），默认当前本地时间。 */
	now?: Date;
}

/** 构造不带扩展名的文件主体：库名_表名_时间戳。 */
export function buildExportBaseName(parts: ExportFileNameParts): string {
	const segments = [sanitizeNameSegment(parts.database), sanitizeNameSegment(parts.tableName)].filter(
		(segment): segment is string => segment.length > 0,
	);
	if (segments.length === 0) {
		segments.push(sanitizeNameSegment(parts.fallback) || EXPORT_FILE_NAME_FALLBACK);
	}
	segments.push(compactExportTimestamp(parts.now ?? new Date()));
	return segments.join("_");
}

/** 构造完整文件名：主体.扩展名；扩展名非法时兜底 txt。 */
export function buildExportFileName(parts: ExportFileNameParts, ext: string): string {
	const normalizedExt = sanitizeNameSegment(String(ext ?? "").replace(/^\./u, "")).toLowerCase();
	return `${buildExportBaseName(parts)}.${normalizedExt || "txt"}`;
}
