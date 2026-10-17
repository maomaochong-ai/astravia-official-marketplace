/**
 * 从自然语言 + 路径里认目标。
 *
 * 两件事分开做，别混在一个函数里：
 *   extractTargetPath   从文本里挑出第一个像路径/URL 的片段；
 *   detectTargetFromMessage  按扩展名 + 关键词判目标类型（扩展名优先）。
 *
 * 为什么不复用 tool-taxonomy 的 detectTargetFromText：那个函数给工具参数用，
 * 参数里可能塞着整段 JSON，加关键词规则会误判；这里只服务用户消息与工作台输入。
 */

import type { TargetKind } from "../data/targets";
import { detectTargetFromText } from "./tool-taxonomy";

const URL_PATTERN = /https?:\/\/[^\s"'`<>)\]]+/i;
const POSIX_PATH_PATTERN = /(?:~\/|\/)(?:[\w.@+% -]+\/)*[\w.@+%-]+/;
/**
 * Windows 路径里带空格是常态（`C:\\Program Files\\...`），所以空格后只要还跟着 ASCII
 * 路径字符就继续吃；中文/标点处停下，避免把后面的自然语言一起当成路径。
 */
const WINDOWS_PATH_PATTERN = /[A-Za-z]:\\[^\s"'`<>|]+(?: [A-Za-z0-9_.\\~-][^\s"'`<>|]*)*/;
const FILENAME_PATTERN =
	/[\w.-]+\.(?:apk|aab|dex|ipa|app|hap|har|asar|dll|exe|winmd|bin|elf|so|dylib|img|rom|fw|js|mjs|cjs|ts|jsx)\b/i;

/** 关键词规则：扩展名判断不出来时按语义词猜。顺序有意义，先命中先用。 */
const MESSAGE_RULES: readonly { readonly test: RegExp; readonly kind: TargetKind }[] = [
	{ test: /javascript|electron|asar|source ?map|node\.?js|小程序/i, kind: "javascript" },
	{ test: /\.net\b|c#|dotnet|ilspy|mono\b|unity|unity3d/i, kind: "dotnet" },
	{ test: /android|\bapk\b|\bipa\b|ios\b|安卓|苹果|flutter|harmony|鸿蒙|手机/i, kind: "mobile" },
	{ test: /firmware|固件|路由器|router|\biot\b|binwalk|flash dump|裸机/i, kind: "firmware" },
	{ test: /https?:\/\//i, kind: "web" },
	{ test: /网页|web ?app|抓包|\bhar\b|websocket|http\/2|浏览器/i, kind: "web" },
	{ test: /macho|dylib|ghidra|hopper|\bida\b|native|反汇编|二进制|elf\b|c\+\+|dmg/i, kind: "native" },
];

/**
 * 封装型扩展名：只说「这是一个盒子」，说不出里面装的是什么。
 *   `.app` 可能是 macOS 原生应用，也可能是 Electron 应用；
 *   `.bin` / `.img` / `.rom` / `.fw` 可能是原生二进制，也可能是固件镜像。
 * 遇到这类目标，消息里的产品词（Electron / 固件 / 安卓…）比扩展名更可信。
 */
const AMBIGUOUS_PATH = /\.(app|bin|img|rom|fw|dat)$/i;

/** 文本里第一个像目标路径/URL 的片段；没有返回 null。 */
export function extractTargetPath(text: string): string | null {
	const trimmed = text.trim();
	if (trimmed.length === 0) return null;
	const url = URL_PATTERN.exec(trimmed);
	if (url) return url[0];
	const windows = WINDOWS_PATH_PATTERN.exec(trimmed);
	if (windows) return windows[0];
	const posix = POSIX_PATH_PATTERN.exec(trimmed);
	if (posix) return posix[0].trim();
	const filename = FILENAME_PATTERN.exec(trimmed);
	return filename ? filename[0] : null;
}

/** 消息里的产品词 → 目标类型；没有命中返回 null。 */
function matchMessageKind(text: string): TargetKind | null {
	for (const rule of MESSAGE_RULES) {
		if (rule.test.test(text)) return rule.kind;
	}
	return null;
}

/** 用户消息 → 目标类型：封装型扩展名先看产品词，其余扩展名优先，最后退回关键词。 */
export function detectTargetFromMessage(text: string): TargetKind | null {
	const path = extractTargetPath(text);
	const byPath = detectTargetFromText(path) ?? detectTargetFromText(text);
	if (byPath !== null && path !== null && AMBIGUOUS_PATH.test(path)) {
		const byContent = matchMessageKind(text);
		if (byContent !== null) return byContent;
	}
	return byPath ?? matchMessageKind(text);
}

export interface TargetHint {
	readonly kind: TargetKind | null;
	readonly path: string | null;
}

export function inferTargetHint(text: string): TargetHint {
	return { kind: detectTargetFromMessage(text), path: extractTargetPath(text) };
}
