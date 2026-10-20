/**
 * 字符串分类。面板的「字符串」页按类型分色并提供类型筛选，
 * 分类规则只描述形状（URL / IP / 邮箱 / 路径 / 标识符），不判断内容是否有害。
 */

export type StringKind = "url" | "ip" | "email" | "path" | "identifier" | "text";

export const STRING_KINDS: readonly StringKind[] = ["url", "email", "ip", "path", "identifier", "text"];

const URL_PATTERN = /^(?:https?|wss?|ftp):\/\/[^\s]+$/i;
const EMAIL_PATTERN = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const DOTTED_NAME_PATTERN = /^[a-z_$][\w$]*(?:\.[a-z_$][\w$]*){2,}$/i;
const SMALI_DESCRIPTOR_PATTERN = /^L[\w$/]+;$/;
const POSIX_PATH_PATTERN = /^(?:\/(?:[\w.+-]+\/)*[\w.+-]+|\/[\w.+-]+)$/;
const WINDOWS_PATH_PATTERN = /^[a-z]:\\(?:[^\\]+\\)*[^\\]*$/i;

function isIpv4(value: string): boolean {
	if (!IPV4_PATTERN.test(value)) return false;
	return value.split(".").every(part => Number(part) <= 255);
}

/** 单个字符串的类型判定；顺序有意义（URL 里也含点号，必须先判 URL）。 */
export function stringKind(value: string): StringKind {
	const trimmed = value.trim();
	if (trimmed.length === 0) return "text";
	if (URL_PATTERN.test(trimmed)) return "url";
	if (EMAIL_PATTERN.test(trimmed)) return "email";
	if (isIpv4(trimmed)) return "ip";
	if (SMALI_DESCRIPTOR_PATTERN.test(trimmed)) return "identifier";
	if (DOTTED_NAME_PATTERN.test(trimmed)) return "identifier";
	if (POSIX_PATH_PATTERN.test(trimmed) || WINDOWS_PATH_PATTERN.test(trimmed)) return "path";
	return "text";
}

export function countKinds(values: readonly string[]): Record<StringKind, number> {
	const counts: Record<StringKind, number> = { url: 0, ip: 0, email: 0, path: 0, identifier: 0, text: 0 };
	for (const value of values) counts[stringKind(value)] += 1;
	return counts;
}
