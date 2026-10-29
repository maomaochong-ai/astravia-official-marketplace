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

	/** 仅测试用：故意制造落后 revision，验证冲突分支。 */
	bumpRevision(): string {
		this.revision += 1;
		return `rev-${this.revision}`;
	}

	snapshot(): Record<string, string> {
		return Object.fromEntries(this.files);
	}
}
