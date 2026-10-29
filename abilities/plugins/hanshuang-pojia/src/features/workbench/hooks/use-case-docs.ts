import { useCallback, useEffect, useState } from "react";
import { joinPath } from "../../../domain/toolchain/paths";
import type { WorkbenchBridge } from "../bridge";

/** 预览里可读的一篇正文；`id` 是相对案例目录的路径，也是选中标识。 */
export interface CaseDocFile {
	id: string;
	path: string;
	label: string;
	/** 子目录名；案例根目录为空串。 */
	group: string;
}

/** 案例根下这几份按阅读顺序排在最前，其余按名字。 */
const ROOT_ORDER = ["scope.md", "README.md", "timeline.md"];
/** 只列这三类子目录：samples/ 与 exports/ 是字节与产物，不是给人读的正文。 */
const SUBDIRS = ["docs", "report", "evidence"] as const;
/** 证据条目会到几十份，超出就不再往标签条里塞。 */
const MAX_FILES = 80;

export interface CaseDocsModel {
	files: CaseDocFile[];
	active: string | null;
	body: string | null;
	loading: boolean;
	/** i18n 键，由页面负责翻译；null 表示这次读取没问题。 */
	error: string | null;
	select(id: string): void;
}

function rootRank(id: string): number {
	// 两边都小写：`README.md` 在数组里是大写，只把 id 转小写就永远匹配不到它。
	const index = ROOT_ORDER.findIndex(name => name.toLowerCase() === id.toLowerCase());
	return index === -1 ? ROOT_ORDER.length : index;
}

/**
 * 读一个案例目录里能看的 Markdown。
 *
 * 案例页原先只给路径、让人自己去编辑器里翻；预览要在这里读出正文，所以沿用 `CaseReadPort`
 * 的同一组宿主通道（`listFiles` / `readTextFile`），不新增权限，也不写盘。
 */
export function useCaseDocs(bridge: WorkbenchBridge, casePath: string | null): CaseDocsModel {
	const [files, setFiles] = useState<CaseDocFile[]>([]);
	const [active, setActive] = useState<string | null>(null);
	const [body, setBody] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setFiles([]);
		setActive(null);
		setBody(null);
		setError(null);
		if (!casePath) return;

		let cancelled = false;
		setLoading(true);

		const list = async (directory: string, group: string): Promise<CaseDocFile[]> => {
			try {
				const entries = await bridge.listFiles(directory);
				return entries
					.filter(entry => !entry.isDirectory && entry.name.toLowerCase().endsWith(".md"))
					.map(entry => ({ id: group ? `${group}/${entry.name}` : entry.name, path: entry.path, label: entry.name, group }));
			} catch {
				// 子目录可以不存在：案例只有 scope.md 也是合法的。
				return [];
			}
		};

		void Promise.all([list(casePath, ""), ...SUBDIRS.map(subdir => list(joinPath(casePath, subdir), subdir))])
			.then(groups => {
				if (cancelled) return;
				const root = groups[0]!.sort((a, b) => rootRank(a.id) - rootRank(b.id) || a.label.localeCompare(b.label));
				const nested = groups.slice(1).flatMap(group => group.sort((a, b) => a.label.localeCompare(b.label)));
				const found = [...root, ...nested].slice(0, MAX_FILES);
				setFiles(found);
				setActive(found[0]?.id ?? null);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [bridge, casePath]);

	useEffect(() => {
		const file = files.find(entry => entry.id === active);
		if (!file) {
			setBody(null);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		void bridge
			.readTextFile(file.path)
			.then(text => {
				if (cancelled) return;
				if (text === null) {
					setBody(null);
					setError("cases.reader.unreadable");
					return;
				}
				setBody(text);
			})
			.catch(() => {
				if (cancelled) return;
				setBody(null);
				setError("cases.reader.unreadable");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [bridge, active, files]);

	const select = useCallback((id: string) => setActive(id), []);

	return { files, active, body, loading, error, select };
}
