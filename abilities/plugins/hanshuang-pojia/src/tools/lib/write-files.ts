/**
 * 往项目里落文本文件的小工具：逐级建目录、可跳过已存在文件、返回写入/跳过清单。
 *
 * 两处共用（先例落盘、工程骨架落盘），因为它们面对的是同一个宿主 `fs`：
 * `createDirectory` 不保证递归，`writeFile` 不保证父目录存在，而失败必须能被工具
 * 原样报回去——不能让「写了一半」看起来像成功。
 */

export interface WriteFs {
	readonly stat: (path: string) => Promise<unknown>;
	readonly createDirectory: (path: string) => Promise<void>;
	readonly writeFile: (path: string, content: string) => Promise<void>;
}

export interface WriteRequest {
	readonly path: string;
	readonly content: string;
}

export interface WriteResult {
	readonly written: string[];
	readonly skipped: string[];
}

/** 逐级建目录：宿主的 `createDirectory` 不保证递归，缺一层就失败。 */
export async function ensureDir(fs: Pick<WriteFs, "createDirectory">, dir: string): Promise<void> {
	const parts = dir.split("/").filter(Boolean);
	let current = dir.startsWith("/") ? "" : ".";
	for (const part of parts) {
		current = `${current}/${part}`;
		try {
			await fs.createDirectory(current);
		} catch {
			// 已存在就是我们要的状态；其余错误留给随后的写入暴露。
		}
	}
}

export async function writeFiles(fs: WriteFs, base: string, files: readonly WriteRequest[], overwrite: boolean): Promise<WriteResult> {
	const written: string[] = [];
	const skipped: string[] = [];

	for (const file of files) {
		const destination = `${base}/${file.path}`;
		if (!overwrite) {
			const existing = await fs.stat(destination).catch(() => null);
			if (existing) {
				skipped.push(file.path);
				continue;
			}
		}
		const parent = destination.slice(0, destination.lastIndexOf("/"));
		if (parent) await ensureDir(fs, parent);
		await fs.writeFile(destination, file.content);
		written.push(file.path);
	}

	return { written, skipped };
}
