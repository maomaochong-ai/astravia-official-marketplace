import type { PluginFsApi, PluginFsStatResult } from "@astravia-org/plugin-sdk";
import { fromBase64 } from "../domain/base64";

/** 单文件读取上限：再大就不是「体检一个样本」，而是分析整个固件镜像。 */
export const MAX_SAMPLE_BYTES = 160 * 1024 * 1024;

export interface LoadedSample {
	path: string;
	name: string;
	bytes: Uint8Array;
}

const WINDOWS_ABSOLUTE = /^[a-zA-Z]:[\\/]/;

export function isAbsolutePath(value: string): boolean {
	return value.startsWith("/") || WINDOWS_ABSOLUTE.test(value) || value.startsWith("\\\\");
}

/** 相对路径一律相对会话工作目录解析；".." 直接消掉，不让工具越出 cwd。 */
export function resolveSamplePath(cwd: string, raw: string): string {
	const value = raw.trim().replace(/^["']|["']$/g, "");
	if (value.length === 0) throw new Error("path is required");
	if (isAbsolutePath(value)) return value;
	const separator = cwd.includes("\\") && !cwd.includes("/") ? "\\" : "/";
	const segments = cwd.split(/[\\/]+/).filter(Boolean);
	for (const part of value.split(/[\\/]+/)) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			if (segments.length > 1) segments.pop();
			continue;
		}
		segments.push(part);
	}
	const joined = segments.join(separator);
	return cwd.startsWith("/") ? `/${joined}` : joined;
}

export function baseName(path: string): string {
	const parts = path.split(/[\\/]+/).filter(Boolean);
	return parts[parts.length - 1] ?? path;
}

export async function loadSample(fs: PluginFsApi, cwd: string, raw: string): Promise<LoadedSample> {
	const path = resolveSamplePath(cwd, raw);
	let entry: PluginFsStatResult | null = null;
	try {
		entry = await fs.stat(path);
	} catch {
		// 宿主的文件能力只授权到已打开的项目根目录，越界时抛的是被包住的 CapabilityError。
		throw new Error(
			`${path} is not readable: the host only grants plugins file access inside the open project directory`,
		);
	}
	if (!entry) throw new Error(`file not found: ${path}`);
	if (entry.size > MAX_SAMPLE_BYTES) {
		throw new Error(`${path} is ${(entry.size / 1024 / 1024).toFixed(1)} MiB, above the 160 MiB analysis limit`);
	}
	const file = await fs.readBinaryFile(path);
	const bytes = fromBase64(file.data);
	if (bytes.byteLength === 0) throw new Error(`${path} is empty`);
	return { path, name: baseName(path), bytes };
}
