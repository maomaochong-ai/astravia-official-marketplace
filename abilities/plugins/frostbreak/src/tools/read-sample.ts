import type { PluginFsApi, PluginFsStatResult } from "@astravia-org/plugin-sdk";
import { fromBase64 } from "../domain/base64";
import { baseName, resolveSamplePath } from "../domain/sample-path";
import { READ_LIMIT_BYTES, READ_LIMIT_LABEL } from "../domain/sample-scope";

/**
 * 单文件读取上限直接对齐宿主：`fs.readBinaryFile` 在 filesystem-service 里硬性拒绝 32 MiB
 * 以上的文件，所以插件写得再大也只会在 IPC 里失败。
 */
export const MAX_SAMPLE_BYTES = READ_LIMIT_BYTES;

export interface LoadedSample {
	path: string;
	name: string;
	bytes: Uint8Array;
}

export async function loadSample(fs: PluginFsApi, cwd: string, raw: string): Promise<LoadedSample> {
	const path = resolveSamplePath(cwd, raw);
	let entry: PluginFsStatResult | null = null;
	try {
		entry = await fs.stat(path);
	} catch {
		// 宿主的文件能力只授权到已打开的项目根目录，越界时抛的是被包住的 CapabilityError。
		throw new Error(
			`${path} is not readable: the host only grants plugins file access inside the open project directory (${cwd})`,
		);
	}
	if (!entry) throw new Error(`file not found: ${path}`);
	if (entry.size > MAX_SAMPLE_BYTES) {
		throw new Error(
			`${path} is ${(entry.size / 1024 / 1024).toFixed(1)} MiB, above the ${READ_LIMIT_LABEL} the host lets a plugin read`,
		);
	}
	const file = await fs.readBinaryFile(path);
	const bytes = fromBase64(file.data);
	if (bytes.byteLength === 0) throw new Error(`${path} is empty`);
	return { path, name: baseName(path), bytes };
}
