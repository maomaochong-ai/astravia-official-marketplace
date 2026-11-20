/**
 * 读包内纯文本资源（文档、提示词包）。
 *
 * 三条分支对应三种运行形态，行为必须一致，否则「单元测试里能读、装到宿主里读不到」：
 *   - `file:`（vitest）—— 直接读**源目录**（`sourcePrefix`），测试看到的就是要发布会的那份字节；
 *   - `astravia-plugin:`（装进宿主）—— 资源被构建到 `assets/<assetDir>/`，与源码目录不同名；
 *   - dev server —— 直接抓源目录。
 *
 * 为什么必须区分两个前缀：构建把 `src/content/docs/**` 平铺到 `assets/docs/**`
 * （见 `vite.config.ts` 的 `assets/docs/${file}`）。早先这里两处共用一个前缀，
 * 装进宿主后请求的是 `assets/src/content/docs/…` —— 404，于是面板「文档」页与自检页
 * 永远停在「正在载入文档索引」。
 *
 * 拼接写成二元表达式：`new URL(`../../../../${path}`, …)` 会被 Vite 静态分析成
 * 遍历目录根的资源映射，把 package-lock.json 之类全部以 data URI 嵌进 bundle。
 */

export interface PackageAssetPaths {
	/** 源码里的目录，例如 `src/content/docs/`。file: 与 dev 分支用它。 */
	sourcePrefix: string;
	/** 构建产物里的目录，例如 `docs`（即 `assets/docs/`）。宿主分支用它。 */
	assetDir: string;
}

/** 宿主分支的 URL 改写：单独抽出来，方便单测直接断言它拼出的路径。 */
export function hostedAssetUrl(entryUrl: string, assetDir: string, relativePath: string): string {
	const url = new URL(entryUrl);
	const suffix = `/assets/${assetDir}/${relativePath}`;
	url.pathname = url.pathname.replace(/\/assets\/[^/]*$/, suffix);
	return url.toString();
}

export async function readPackageAsset(relativePath: string, paths: PackageAssetPaths): Promise<string> {
	if (import.meta.url.startsWith("file:")) {
		const specifier = "node:fs/promises";
		const { readFile } = (await import(/* @vite-ignore */ specifier)) as typeof import("node:fs/promises");
		const root = "../../../../";
		return readFile(new URL(root + paths.sourcePrefix + relativePath, import.meta.url), "utf8");
	}

	const url = import.meta.url.startsWith("astravia-plugin:")
		? hostedAssetUrl(import.meta.url, paths.assetDir, relativePath)
		: new URL(`/${paths.sourcePrefix}${relativePath}`, import.meta.url).toString();

	const response = await fetch(url);
	if (!response.ok) throw new Error(`package resource unavailable (${response.status}): ${paths.assetDir}/${relativePath}`);
	return response.text();
}
