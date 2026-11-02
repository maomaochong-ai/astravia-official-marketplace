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

/** 测试与本地预览用的内存实现。语义与宿主一致：commit 是唯一发布点。 */
export class MemoryManuscriptStorage implements ManuscriptStorage {
	private files = new Map<string, string>();
	private revision = 0;

	async list(prefix?: string): Promise<string[]> {
		const paths = [...this.files.keys()].sort();
		return prefix ? paths.filter((path) => path.startsWith(prefix)) : paths;
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
