import { decodeUtf8 } from "./bytes";

export interface ExtractedString {
	value: string;
	offset: number;
	encoding: "ascii" | "utf16le";
}

export interface StringScanOptions {
	minLength?: number;
	maxResults?: number;
	maxScanBytes?: number;
	encodings?: readonly ("ascii" | "utf16le")[];
}

const DEFAULT_MAX_RESULTS = 400;
const DEFAULT_MAX_SCAN = 24 * 1024 * 1024;

function isPrintable(code: number): boolean {
	return (code >= 0x20 && code <= 0x7e) || code === 0x09;
}

/**
 * 提取可打印串。只扫一份有上限的样本，既控制耗时，也让报告里的「字符串证据」
 * 不会因为一个 200 MB 的包变成几万行。
 */
export function extractStrings(bytes: Uint8Array, options: StringScanOptions = {}): ExtractedString[] {
	const minLength = Math.max(2, options.minLength ?? 4);
	const maxResults = Math.max(1, options.maxResults ?? DEFAULT_MAX_RESULTS);
	const limit = Math.min(bytes.byteLength, options.maxScanBytes ?? DEFAULT_MAX_SCAN);
	const encodings = options.encodings ?? ["ascii", "utf16le"];
	const seen = new Set<string>();
	const out: ExtractedString[] = [];

	if (encodings.includes("ascii")) {
		let start = -1;
		for (let index = 0; index < limit; index += 1) {
			const printable = isPrintable(bytes[index]!);
			if (printable && start < 0) start = index;
			if ((!printable || index === limit - 1) && start >= 0) {
				const end = printable ? index + 1 : index;
				if (end - start >= minLength) push(decodeUtf8(bytes.subarray(start, end)), start, "ascii");
				start = -1;
				if (out.length >= maxResults) return out;
			}
		}
	}

	if (encodings.includes("utf16le")) {
		let start = -1;
		let index = 0;
		while (index + 1 < limit) {
			const low = bytes[index]!;
			const high = bytes[index + 1]!;
			const printable = isPrintable(low) && high === 0;
			if (printable && start < 0) start = index;
			if (!printable && start >= 0) {
				const characters = (index - start) / 2;
				if (characters >= Math.max(3, minLength)) {
					let value = "";
					for (let cursor = start; cursor < index; cursor += 2) value += String.fromCharCode(bytes[cursor]!);
					push(value, start, "utf16le");
				}
				start = -1;
				if (out.length >= maxResults) return out;
			}
			index += 2;
		}
	}

	function push(value: string, offset: number, encoding: "ascii" | "utf16le"): void {
		const trimmed = value.trim();
		if (trimmed.length < minLength) return;
		const key = `${encoding}:${trimmed}`;
		if (seen.has(key)) return;
		seen.add(key);
		out.push({ value: trimmed, offset, encoding });
	}

	return out;
}

/** 把用户输入当成正则；写错时退回字面量子串匹配，而不是抛错给 UI。 */
export function compilePattern(pattern: string, caseSensitive = false): { test: (value: string) => boolean; literal: boolean } {
	if (!pattern) return { test: () => true, literal: false };
	try {
		const regex = new RegExp(pattern, caseSensitive ? "" : "i");
		return { test: (value: string) => regex.test(value), literal: false };
	} catch {
		const needle = caseSensitive ? pattern : pattern.toLowerCase();
		return {
			test: (value: string) => (caseSensitive ? value : value.toLowerCase()).includes(needle),
			literal: true,
		};
	}
}

export interface ApiFingerprint {
	pattern: RegExp;
	/** 规则 id；文案由 rules 注册表统一提供，领域层不写死某种语言。 */
	ruleId: string;
}

/** 常见「值得看一眼」的 API 指纹。命中只是线索，报告里始终标注为字符串级证据。 */
export const API_FINGERPRINTS: readonly ApiFingerprint[] = [
	{ pattern: /\bDexClassLoader\b|\bPathClassLoader\b|\bInMemoryDexClassLoader\b/, ruleId: "apk.dynamic-loading" },
	{ pattern: /\bRuntime\.exec\b|\bProcessBuilder\b|\bRuntime\.getRuntime\b/, ruleId: "apk.shell-exec" },
	{ pattern: /\bSystem\.load(?:Library)?\b/, ruleId: "apk.native-loading" },
	{ pattern: /\bgetDeviceId\b|\bgetImei\b|\bgetSubscriberId\b|\bgetSimSerialNumber\b/, ruleId: "apk.device-identifiers" },
	{ pattern: /\bgetLastKnownLocation\b|\brequestLocationUpdates\b/, ruleId: "apk.location-tracking" },
	{ pattern: /AES\/ECB|DES\/ECB|\bDESede\b|\bMD5\b/, ruleId: "apk.weak-crypto" },
	{ pattern: /Landroid\/content\/pm\/PackageInstaller|ACTION_INSTALL_PACKAGE|REQUEST_INSTALL_PACKAGES/, ruleId: "apk.package-install" },
	{ pattern: /java\.net\.URLClassLoader|loadClass\(/, ruleId: "apk.reflection" },
	{ pattern: /su\b|Superuser|magisk/i, ruleId: "apk.root-trace" },
];

export function matchApiFingerprints(strings: readonly string[]): { ruleId: string; evidence: string }[] {
	const hits: { ruleId: string; evidence: string }[] = [];
	const seen = new Set<string>();
	for (const fingerprint of API_FINGERPRINTS) {
		const match = strings.find(value => fingerprint.pattern.test(value));
		if (!match || seen.has(fingerprint.ruleId)) continue;
		seen.add(fingerprint.ruleId);
		hits.push({ ruleId: fingerprint.ruleId, evidence: match.slice(0, 160) });
	}
	return hits;
}
