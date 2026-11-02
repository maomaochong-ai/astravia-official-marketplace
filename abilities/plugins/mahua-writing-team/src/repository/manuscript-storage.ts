/**
 * 存储边界。
 *
 * 仓储不依赖 `PluginContext`，只依赖这个结构子集（与 `PluginStorageApi` 同形），
 * 于是同一份实现能在宿主里跑、也能在内存里跑测试（ADR 0005）。
 */

export interface StorageWrite {
	path: string;
	data: string;
	encoding: "utf8" | "base64";
}

export type StorageChange =
	| ({ type: "write" } & StorageWrite)
	| { type: "remove"; path: string };

export interface ManuscriptStorage {
	list(prefix?: string): Promise<string[]>;
	readFile(path: string, encoding: "utf8" | "base64"): Promise<string | null>;
	commit(
		changes: readonly StorageChange[],
		options?: { expectedRevision?: string },
	): Promise<{ revision: string; changedPaths: string[] }>;
	/**
	 * 原子读：同一 revision 下若干路径的内容。宿主的 `PluginStorageApi` 就有这个方法，
	 * 结构上直接满足；写之前用它取新鲜基线，是「不再拿着秒级过期 revision 去写」的关键。
	 * 缺席时（老宿主或精简替身）退回调用方传来的 `expectedRevision`。
	 */
	readSnapshot?(
		paths: readonly string[],
		encoding: "utf8" | "base64",
	): Promise<{ revision: string; files: Record<string, string | null> }>;
}

/**
 * 宿主 `listPluginFiles()` 在 prefix 非空时先过一遍 `normalizeStoragePath()`：空分段、`.`、`..`、
 * 绝对路径都直接抛错。`books/<id>/` 的尾斜杠恰好切出一个空分段，于是这个看起来最自然的
 * 「拿书名做前缀过滤」写法，在真宿主上必然失败——而内存替身原来只做 `startsWith`，比真宿主宽松，
 * 所以这类错误一路穿到用户面前（0.4.33 的「删不掉」）。替身必须更严格，不能更宽松。
 */
function storagePathProblem(path: string): string | null {
	const normalized = path.replaceAll("\\", "/");
	if (!normalized) return "the path is empty";
	if (normalized.includes("\0")) return "the path contains a NUL byte";
	if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) return "the path is absolute";
	if (normalized.split("/").some((segment) => segment === "" || segment === "." || segment === ".."))
		return "the path has an empty or relative segment";
	return null;
}

/**
 * 把存储层抛回来的错误压成一句人能读的话。
 *
 * Electron 会给 IPC 失败套一层 `Error invoking remote method '<channel>': `。那层壳里的通道名
 * 对用户没有任何意义，却会把真正的信息（哪个能力、因为什么）挤到屏幕外。
 */
export function storageErrorText(error: unknown): string {
	const raw = error instanceof Error ? error.message : String(error);
	return raw.replace(/^Error invoking remote method '[^']*':\s*/, "");
}

/** 测试与本地预览用的内存实现。语义与宿主一致：commit 是唯一发布点。 */
export class MemoryManuscriptStorage implements ManuscriptStorage {
	private files = new Map<string, string>();
	private revision = 0;

	async list(prefix?: string): Promise<string[]> {
		// 与宿主同款：空串走「整个命名空间」那条路（宿主写的是 `prefix ? … : ""`），
		// 非空则必须先是一个合法的相对路径，匹配时按整段比较，而不是按字符前缀。
		let normalizedPrefix = "";
		if (prefix) {
			const problem = storagePathProblem(prefix);
			if (problem !== null) throw new Error(`Invalid plugin storage path: ${problem}`);
			normalizedPrefix = prefix.replace(/\/$/, "");
		}
		const paths = [...this.files.keys()].sort();
		return paths.filter(
			(path) =>
				!normalizedPrefix || path === normalizedPrefix || path.startsWith(`${normalizedPrefix}/`),
		);
	}

	async readFile(path: string): Promise<string | null> {
		return this.files.get(path) ?? null;
	}

	async commit(
		changes: readonly StorageChange[],
		options?: { expectedRevision?: string },
	): Promise<{ revision: string; changedPaths: string[] }> {
		const current = `rev-${this.revision}`;
		if (options?.expectedRevision && options.expectedRevision !== current) {
			throw new Error(`revision-conflict: expected ${options.expectedRevision}, current ${current}`);
		}
		const next = new Map(this.files);
		for (const change of changes) {
			if (change.type === "remove") next.delete(change.path);
			else next.set(change.path, change.data);
		}
		this.files = next;
		this.revision += 1;
		return { revision: `rev-${this.revision}`, changedPaths: changes.map((change) => change.path) };
	}

	async readSnapshot(
		paths: readonly string[],
		_encoding: "utf8" | "base64",
	): Promise<{ revision: string; files: Record<string, string | null> }> {
		const files: Record<string, string | null> = {};
		for (const path of paths) files[path] = this.files.get(path) ?? null;
		return { revision: `rev-${this.revision}`, files };
	}

	/** 仅测试用：故意制造落后 revision，验证冲突分支。 */
	bumpRevision(): string {
		this.revision += 1;
		return `rev-${this.revision}`;
	}

	snapshot(): Record<string, string> {
		return Object.fromEntries(this.files);
	}
}
