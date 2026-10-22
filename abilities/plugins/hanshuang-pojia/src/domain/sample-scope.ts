import { isOutsideProject } from "./sample-path";

/**
 * 宿主读取二进制的硬上限（filesystem-service 的 MAX_BINARY_FILE_SIZE = 32 MiB）。
 * 插件自己再宽松也没有意义：超过这个大小，宿主在 `fs.readBinaryFile` 里直接抛错。
 */
export const READ_LIMIT_BYTES = 32 * 1024 * 1024;

export const READ_LIMIT_LABEL = "32 MiB";

/**
 * 样本能不能交给本地引擎：
 * - `outside-project`：宿主只授权项目根目录，路径在项目外时连 stat 都拿不到；
 * - `too-large`：宿主拒绝读取超过上限的二进制；
 * - `ready`：引擎可以直接读。
 */
export type SampleScope = "ready" | "outside-project" | "too-large";

export function scopeForSample(raw: string, cwd: string | null, size: number | null): SampleScope {
	// No workspace attached: nothing to be outside of. `isOutsideProject` keeps its stricter stance
	// for the command channel, which never passes through the host's own root check.
	if (cwd && isOutsideProject(raw, cwd)) return "outside-project";
	if (size !== null && size > READ_LIMIT_BYTES) return "too-large";
	return "ready";
}
