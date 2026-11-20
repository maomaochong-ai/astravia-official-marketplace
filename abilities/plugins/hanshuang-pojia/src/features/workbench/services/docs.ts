/**
 * 随插件发布的工具包文档：索引、惰性正文加载与检索。
 *
 * 两份东西都**不进 JS 分块**（ADR 0009 D5）：
 *   - 索引（index.json / assets.json）在首次使用时按需读取，110 KB 不再压启动；
 *   - 正文全部以纯文本随包发布到 dist/assets/docs/，点开哪一篇才读哪篇。
 *     已编译成脚本的工具链语料既拖慢安装，也会被系统杀毒当成可执行样本。
 *
 * 因为索引是异步到达的，所有查询都挂在 `DocsLibrary` 上：先 `await loadDocsLibrary()`，
 * 再对它做同步检索。这样「索引未就绪」是一个类型上看得见的状态，而不是空数组。
 */

export interface DocEntry {
	id: string;
	group: string;
	topic: string;
	title: string;
	path: string;
	bytes: number;
	lines: number;
	sha256: string;
	/** `asset` 是机器可读附件（signal 索引、工具索引），不是文章。 */
	kind?: "doc" | "asset";
}

interface AssetEntry {
	id: string;
	group: string;
	topic: string;
	label: string;
	path: string;
	bytes: number;
	lines: number;
	sha256: string;
}

export interface DocTotals {
	documents: number;
	/** 机器可读附件数；自检页用它确认索引没掉。 */
	assets: number;
	bytes: number;
	lines: number;
	/** 按分组统计；自检页拿它核对三组都没掉。 */
	byGroup: Record<string, number>;
}

export interface DocTopic {
	id: string;
	entries: DocEntry[];
}

export interface DocGroup {
	id: string;
	topics: DocTopic[];
}

export interface DocHit {
	entry: DocEntry;
	/** 正文命中时给出的片段；标题命中时为空。 */
	snippet: string;
}

export const DOC_GROUPS = [
	{ id: "kb", labelKey: "docs.group.kb" },
	{ id: "manual", labelKey: "docs.group.manual" },
	{ id: "kit-docs", labelKey: "docs.group.kitDocs" },
	{ id: "cases", labelKey: "docs.group.cases" },
	{ id: "reference", labelKey: "docs.group.reference" },
] as const;

/** 文档目录在包内的相对位置：构建时整棵拷到 dist/docs/，与 dist/assets/ 平级。 */
const DOC_PREFIX = "src/content/docs/";

/** 文档与提示词包共用同一个读资源实现，三条运行形态的分支只写一遍。 */
import { readPackageAsset } from "./package-asset";

export interface DocsLibrary {
	/** 文章索引，340 条；不含附件。 */
	readonly entries: readonly DocEntry[];
	/** 机器可读附件，5 条。 */
	readonly assets: readonly DocEntry[];
	readonly totals: DocTotals;
	byId(id: string): DocEntry | undefined;
	/** 导航树：按分组 → 主题归档，不含附件。 */
	groups(): DocGroup[];
	/** 标题 / id 检索：纯内存，输入即时可用。 */
	searchTitles(query: string, limit?: number): DocHit[];
	/** 全文检索：需要把正文读进内存，只在用户显式切换时调用。 */
	searchFullText(query: string, limit?: number): Promise<DocHit[]>;
	/** 读一篇正文（不含索引头）。未知 id 抛错。 */
	loadBody(id: string): Promise<string>;
}

/**
 * 读包内资源：实现见 `package-asset.ts`（file: / astravia-plugin: / dev 三条分支）。
 * 这里的注释保留是为了说清「为什么要按源目录路径拼」：测试看的必须是发布的那份字节。
 */
async function readPackageText(relativePath: string): Promise<string> {
	// 源码在 src/content/docs/，构建后平铺到 assets/docs/ —— 两个前缀必须分开给。
	return readPackageAsset(relativePath, { sourcePrefix: DOC_PREFIX, assetDir: "docs" });
}

/** 条目的 path 是源目录相对路径；资源层只认剥掉前缀之后的相对位置。 */
function resourceOf(entry: DocEntry): string {
	return entry.path.startsWith(DOC_PREFIX) ? entry.path.slice(DOC_PREFIX.length) : entry.path;
}

function toDocEntry(asset: AssetEntry): DocEntry {
	return {
		id: asset.id,
		group: asset.group,
		topic: asset.topic,
		title: asset.label,
		path: asset.path,
		bytes: asset.bytes,
		lines: asset.lines,
		sha256: asset.sha256,
		kind: "asset",
	};
}

function buildLibrary(rawEntries: DocEntry[], rawAssets: AssetEntry[]): DocsLibrary {
	const entries = rawEntries.slice().sort((left, right) => left.id.localeCompare(right.id));
	const assets = rawAssets.map(toDocEntry);
	const byIdMap = new Map<string, DocEntry>();
	for (const entry of [...entries, ...assets]) byIdMap.set(entry.id, entry);

	const bodyCache = new Map<string, string>();

	const totals: DocTotals = {
		documents: entries.length,
		assets: assets.length,
		bytes: entries.reduce((total, entry) => total + entry.bytes, 0),
		lines: entries.reduce((total, entry) => total + entry.lines, 0),
		byGroup: entries.reduce<Record<string, number>>((counts, entry) => {
			counts[entry.group] = (counts[entry.group] ?? 0) + 1;
			return counts;
		}, {}),
	};

	const byId = (id: string): DocEntry | undefined => byIdMap.get(id);

	const loadBody = async (id: string): Promise<string> => {
		const cached = bodyCache.get(id);
		if (cached !== undefined) return cached;
		const entry = byId(id);
		if (!entry) throw new Error(`unknown document: ${id}`);
		const text = await readPackageText(resourceOf(entry));
		bodyCache.set(id, text);
		return text;
	};

	const groups = (): DocGroup[] =>
		DOC_GROUPS.map(group => {
			const scoped = entries.filter(entry => entry.group === group.id);
			const topics = new Map<string, DocEntry[]>();
			for (const entry of scoped) {
				const key = entry.topic || "";
				const bucket = topics.get(key);
				if (bucket) bucket.push(entry);
				else topics.set(key, [entry]);
			}
			return {
				id: group.id,
				topics: [...topics]
					.map(([id, list]) => ({ id, entries: list.slice().sort((a, b) => a.title.localeCompare(b.title)) }))
					.sort((a, b) => a.id.localeCompare(b.id)),
			};
		}).filter(group => group.topics.length > 0);

	const searchTitles = (query: string, limit = 80): DocHit[] => {
		const needle = query.trim().toLowerCase();
		if (!needle) return [];
		const hits: DocHit[] = [];
		for (const entry of entries) {
			if (entry.title.toLowerCase().includes(needle) || entry.id.toLowerCase().includes(needle)) hits.push({ entry, snippet: "" });
			if (hits.length >= limit) break;
		}
		return hits;
	};

	const searchFullText = async (query: string, limit = 60): Promise<DocHit[]> => {
		const needle = query.trim().toLowerCase();
		if (needle.length < 2) return [];
		const hits: DocHit[] = [];
		for (const entry of entries) {
			const titleHit = entry.title.toLowerCase().includes(needle) || entry.id.toLowerCase().includes(needle);
			let text: string;
			try {
				text = await loadBody(entry.id);
			} catch {
				continue;
			}
			if (titleHit) hits.push({ entry, snippet: "" });
			else {
				const at = text.toLowerCase().indexOf(needle);
				if (at >= 0) hits.push({ entry, snippet: text.slice(Math.max(0, at - 60), at + 140).replace(/\s+/g, " ").trim() });
			}
			if (hits.length >= limit) break;
		}
		return hits;
	};

	return { entries, assets, totals, byId, groups, searchTitles, searchFullText, loadBody };
}

let library: DocsLibrary | null = null;
let inflight: Promise<DocsLibrary> | null = null;

/**
 * 读索引并构造库。并发调用共享同一次加载；失败不缓存，下一次调用可以重试。
 */
export function loadDocsLibrary(): Promise<DocsLibrary> {
	if (library) return Promise.resolve(library);
	if (inflight) return inflight;
	inflight = (async () => {
		const [indexText, assetsText] = await Promise.all([
			readPackageText("index.json"),
			readPackageText("assets.json"),
		]);
		const built = buildLibrary(JSON.parse(indexText) as DocEntry[], JSON.parse(assetsText) as AssetEntry[]);
		library = built;
		return built;
	})().finally(() => {
		inflight = null;
	});
	return inflight;
}

/** 已加载的库。未加载时抛错——不要用空数组假装「没有文档」。 */
export function docsLibrary(): DocsLibrary {
	if (!library) throw new Error("document library is not loaded: await loadDocsLibrary() first");
	return library;
}

/** 测试用：清掉缓存，让下一次 loadDocsLibrary 重新读盘。 */
export function resetDocsLibrary(): void {
	library = null;
	inflight = null;
}
