/**
 * 随插件发布的工具包文档：索引、惰性正文加载与检索。
 *
 * 正文不进任何 JS 分块 —— 全部文档以纯文本随包发布到 dist/assets/docs/，
 * 点开哪一篇才读哪篇。已编译成脚本的工具链语料既拖慢安装，也会被系统杀毒
 * 当成可执行样本；纯文本没有这个风险。
 */
import assets from "../../../content/docs/assets.json";
import index from "../../../content/docs/index.json";

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

export const DOC_ENTRIES = index as DocEntry[];

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

/**
 * 附件：`kb/<分类>/techniques/kb-index.json`（信号 → 技术文件）与
 * `kit-docs/tool-index.json`（42 项工具清单）。
 *
 * 它们不进全文索引 —— 否则全文检索会把 292 篇正文扫一遍，命中的却是一张映射表 ——
 * 但 `read_doc` 能按 id 直接打开，agent 想精确路由时读它比全文搜索快得多。
 */
export const ASSET_ENTRIES: DocEntry[] = (assets as AssetEntry[]).map(asset => ({
	id: asset.id,
	group: asset.group,
	topic: asset.topic,
	title: asset.label,
	path: asset.path,
	bytes: asset.bytes,
	lines: asset.lines,
	sha256: asset.sha256,
	kind: "asset",
}));

const ALL_ENTRIES: DocEntry[] = [...DOC_ENTRIES, ...ASSET_ENTRIES];

export const DOC_GROUPS = [
	{ id: "kb", labelKey: "docs.group.kb" },
	{ id: "manual", labelKey: "docs.group.manual" },
	{ id: "kit-docs", labelKey: "docs.group.kitDocs" },
] as const;

/** 文档目录在包内的相对位置：构建时整棵拷到 dist/docs/，与 dist/assets/ 平级。 */
const DOC_PREFIX = "src/content/docs/";

/**
 * 正文不进 JS 分块，而是作为纯文本资源随包发布，点开哪篇才读哪篇。
 * 构建期见 vite.config.ts 的 runtime-resources 插件。
 */
async function readBody(path: string): Promise<string> {
	const rel = path.startsWith(DOC_PREFIX) ? path.slice(DOC_PREFIX.length) : path;
	// 单元测试跑在 Node 里，import.meta.url 是 file: —— 直接读源目录，
	// 这样测试看的就是构建真正会发布的那份字节，而不是另一份拷贝。
	if (import.meta.url.startsWith("file:")) {
		const specifier = "node:fs/promises";
		const { readFile } = (await import(/* @vite-ignore */ specifier)) as typeof import("node:fs/promises");
		return readFile(new URL(`../../../../${path}`, import.meta.url), "utf8");
	}
	// 运行期：astravia-plugin:// 直接提供包内文件，无需经过宿主 fs 授权。
	// 开发服务器下路径不同，回退到直接抓源目录。
	const url = new URL(import.meta.url);
	url.pathname =
		url.protocol === "astravia-plugin:" ? url.pathname.replace(/\/assets\/[^/]*$/, `/assets/docs/${rel}`) : `/${path}`;
	const response = await fetch(url.toString());
	if (!response.ok) throw new Error(`document body unavailable (${response.status}): ${rel}`);
	return response.text();
}

const CACHE = new Map<string, string>();

export function docById(id: string): DocEntry | undefined {
	return ALL_ENTRIES.find(entry => entry.id === id);
}

export function docGroups(): Array<{ id: string; topics: Array<{ id: string; entries: DocEntry[] }> }> {
	return DOC_GROUPS.map(group => {
		const entries = DOC_ENTRIES.filter(entry => entry.group === group.id);
		const topics = new Map<string, DocEntry[]>();
		for (const entry of entries) {
			const key = entry.topic || "";
			const bucket = topics.get(key);
			if (bucket) bucket.push(entry);
			else topics.set(key, [entry]);
		}
		return {
			id: group.id,
			topics: [...topics].map(([id, list]) => ({ id, entries: list.slice().sort((a, b) => a.title.localeCompare(b.title)) })).sort((a, b) => a.id.localeCompare(b.id)),
		};
	}).filter(group => group.topics.length > 0);
}

export async function loadDoc(id: string): Promise<string> {
	const cached = CACHE.get(id);
	if (cached !== undefined) return cached;
	const entry = docById(id);
	if (!entry) throw new Error(`unknown document: ${id}`);
	const text = await readBody(entry.path);
	CACHE.set(id, text);
	return text;
}

export interface DocHit {
	entry: DocEntry;
	/** 正文命中时给出的片段；标题命中时为空。 */
	snippet: string;
}

/** 标题/路径检索：纯内存，输入即时可用。 */
export function searchTitles(query: string, limit = 80): DocHit[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	const hits: DocHit[] = [];
	for (const entry of DOC_ENTRIES) {
		if (entry.title.toLowerCase().includes(needle) || entry.id.toLowerCase().includes(needle)) hits.push({ entry, snippet: "" });
		if (hits.length >= limit) break;
	}
	return hits;
}

/**
 * 全文检索：需要把全部文档装进内存（约 4 MB），因此只在用户显式切换时调用，
 * 结果按首个命中位置排序，标题命中优先。
 */
export async function searchFullText(query: string, limit = 60): Promise<DocHit[]> {
	const needle = query.trim().toLowerCase();
	if (needle.length < 2) return [];
	const hits: DocHit[] = [];
	for (const entry of DOC_ENTRIES) {
		const titleHit = entry.title.toLowerCase().includes(needle) || entry.id.toLowerCase().includes(needle);
		let text: string;
		try {
			text = await loadDoc(entry.id);
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
}

export const DOC_TOTALS = {
	documents: DOC_ENTRIES.length,
	/** 机器可读附件数；自检页用它确认索引没掉。 */
	assets: ASSET_ENTRIES.length,
	bytes: DOC_ENTRIES.reduce((total, entry) => total + entry.bytes, 0),
	lines: DOC_ENTRIES.reduce((total, entry) => total + entry.lines, 0),
	/** 按分组统计；自检页拿它核对三组都没掉。 */
	byGroup: DOC_ENTRIES.reduce<Record<string, number>>((totals, entry) => {
		totals[entry.group] = (totals[entry.group] ?? 0) + 1;
		return totals;
	}, {}),
};
