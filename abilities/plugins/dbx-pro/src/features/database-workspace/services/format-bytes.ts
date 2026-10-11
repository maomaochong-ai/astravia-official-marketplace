/**
 * formatBytes —— 字节数的展示格式化（下载后台「大小」列）。
 *
 * 十进制 1000 进制（KB / MB / GB），与系统文件管理器显示的 MB 一致，
 * 不用 1024 进制的 KiB / MiB（用户看到的 MB 就是这里的意思）。
 */

const UNITS = ["KB", "MB", "GB", "TB"] as const;

/** undefined / NaN / 负数一律返回「—」，调用方不需要自己兜底。 */
export function formatBytes(bytes: number | undefined | null): string {
	if (bytes === undefined || bytes === null || !Number.isFinite(bytes) || bytes < 0) return "—";
	if (bytes < 1000) return `${bytes} B`;

	let value = bytes / 1000;
	let unit = 0;
	while (value >= 1000 && unit < UNITS.length - 1) {
		value /= 1000;
		unit += 1;
	}
	return `${value.toFixed(1)} ${UNITS[unit]}`;
}
