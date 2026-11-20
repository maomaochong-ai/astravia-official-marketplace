/**
 * 读包内纯文本资源（文档、提示词包）。
 *
 * 三条分支对应三种运行形态，行为必须一致，否则「单元测试里能读、装到宿主里读不到」：
 *   - `file:`（vitest）—— 直接读源目录，测试看到的就是要发布会的那份字节；
 *   - `astravia-plugin:`（装进宿主）—— 把入口资源路径改写指向 `assets/<prefix>/`；
 *   - dev server —— 直接抓源目录。
 *
 * 拼接写成二元表达式：`new URL(`../../../../${path}`, …)` 会被 Vite 静态分析成
 * 遍历目录根的资源映射，把 package-lock.json 之类全部以 data URI 嵌进 bundle。
 */
export async function readPackageAsset(relativePath: string, prefix: string): Promise<string> {
	if (import.meta.url.startsWith("file:")) {
		const specifier = "node:fs/promises";
		const { readFile } = (await import(/* @vite-ignore */ specifier)) as typeof import("node:fs/promises");
		const root = "../../../../";
		return readFile(new URL(root + prefix + relativePath, import.meta.url), "utf8");
	}
	const url = new URL(import.meta.url);
	url.pathname =
		url.protocol === "astravia-plugin:"
			? url.pathname.replace(/\/assets\/[^/]*$/, `/assets/${prefix}/${relativePath}`)
			: `/${prefix}${relativePath}`;
	const response = await fetch(url.toString());
	if (!response.ok) throw new Error(`package resource unavailable (${response.status}): ${prefix}/${relativePath}`);
	return response.text();
}
