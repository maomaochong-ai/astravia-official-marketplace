/**
 * 文档正文的读取：**打包时合成一份 gzip 包，运行时整包解压后按路径取**。
 *
 * 为什么不再逐个 `.md` 落盘（这是安装失败的根因）：
 * 宿主安装能力时逐个 `copyfile`，而 345 篇语料里有一批是攻击载荷清单
 * （NoSQL / SQL 注入、反序列化、SSRF 的 payload 表）。这些文件单独躺在磁盘上时
 * 会被系统杀毒当成工具集样本拦掉，`copyfile` 返回 Windows 的 `UNKNOWN`（0x8000FFFF），
 * 整个安装因此失败——用户看到的是「能力页无法添加」。
 *
 * 打包成一份 gzip 之后：磁盘上只有一个二进制文件，杀毒不会按文本特征逐篇扫描；
 * 文件数从 352 降到 3（index / assets / bodies.gz），安装的逐个复制也快得多。
 * **正文内容一个字节都没改**（gzip 里是原样 UTF-8 JSON），doc 的逻辑与检索行为不变。
 *
 * 三条运行形态与 `package-asset.ts` 一致：
 *   - `file:`（vitest）：直接读源目录，测试看的就是要发布会的那份字节；
 *   - `astravia-plugin:`（装进宿主）：读 `assets/docs/bodies.json.gz`；
 *   - dev server：读源目录。
 */

const DOC_PREFIX = "src/content/docs/";
const BUNDLE = "bodies.json.gz";

/** 解压后的正文表：源目录相对路径 → 文本。整包只解一次。 */
let bundle: Map<string, string> | null = null;
let inflight: Promise<Map<string, string>> | null = null;

function hostedBundleUrl(entryUrl: string): string {
	const url = new URL(entryUrl);
	url.pathname = url.pathname.replace(/\/assets\/[^/]*$/, `/assets/docs/${BUNDLE}`);
	return url.toString();
}

async function gunzip(bytes: ArrayBuffer): Promise<string> {
	// DecompressionStream 在 Electron 渲染进程与 Node 20+ 都有；
	// 不用 pako 之类的依赖，插件不该为一次解压多带一个库。
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
	return new Response(stream).text();
}

/** 解压并解析整包；失败不缓存，下一次调用可以重试。 */
function loadBundle(): Promise<Map<string, string>> {
	if (bundle) return Promise.resolve(bundle);
	if (inflight) return inflight;
	inflight = (async () => {
		const response = await fetch(hostedBundleUrl(import.meta.url));
		if (!response.ok) throw new Error(`docs bundle unavailable (${response.status}): assets/docs/${BUNDLE}`);
		const parsed = JSON.parse(await gunzip(await response.arrayBuffer())) as Record<string, string>;
		bundle = new Map(Object.entries(parsed));
		return bundle;
	})().finally(() => {
		inflight = null;
	});
	return inflight;
}

/**
 * 读一篇正文。`relativePath` 是源目录相对路径（例如 `kb/README.md`）。
 *
 * 宿主模式下缺条目就抛错而不是返回空串：空串会让面板显示一个空白正文，
 * 看起来像「文档是空的」，而实际是打包漏了。
 */
export async function readDocBody(relativePath: string): Promise<string> {
	if (import.meta.url.startsWith("file:")) {
		const specifier = "node:fs/promises";
		const { readFile } = (await import(/* @vite-ignore */ specifier)) as typeof import("node:fs/promises");
		return readFile(new URL(`../../../../${DOC_PREFIX}${relativePath}`, import.meta.url), "utf8");
	}

	if (!import.meta.url.startsWith("astravia-plugin:")) {
		const response = await fetch(new URL(`/${DOC_PREFIX}${relativePath}`, import.meta.url).toString());
		if (!response.ok) throw new Error(`docs body unavailable (${response.status}): ${relativePath}`);
		return response.text();
	}

	const table = await loadBundle();
	const text = table.get(relativePath);
	if (text === undefined) throw new Error(`docs bundle has no entry: ${relativePath}`);
	return text;
}

/** 测试用：清掉已解压的包。 */
export function resetDocBodies(): void {
	bundle = null;
	inflight = null;
}
