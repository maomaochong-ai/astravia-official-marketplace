/**
 * 测试环境 raw loader —— 模拟 Vite 的 `?raw` / `?url` 后缀。
 *
 * Node.js ESM 默认只认识 .js/.mjs/.cjs/.json，遇到 .css 或带 ?raw 的路径
 * 会在 resolve 阶段就报 ERR_UNKNOWN_FILE_EXTENSION。
 * 所以必须同时 hook resolve（把 .css / .css?raw 标记 format=module）
 * 和 load（读文件内容 → export default 字符串）。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RAW_OR_URL = /\?(raw|url)$/;
const ASSET_EXT = /\.(css|json|html|svg|png|jpg|jpeg|gif|woff2?|ttf|eot)$/i;

export async function resolve(specifier, context, nextResolve) {
	// 相对路径 + 带 ?raw/?url 或 asset 扩展名 → 标记 format=module 让 Node 不拒
	if (
		(specifier.startsWith("./") || specifier.startsWith("../")) &&
		(RAW_OR_URL.test(specifier) || ASSET_EXT.test(specifier))
	) {
		const result = await nextResolve(specifier, { ...context, format: "module" });
		return { ...result, format: "module" };
	}
	return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
	const match = url.match(RAW_OR_URL);
	if (!match) return nextLoad(url, context);

	const [, suffix] = match;
	const cleanUrl = url.replace(RAW_OR_URL, "");

	try {
		if (suffix === "raw") {
			const content = readFileSync(fileURLToPath(cleanUrl), "utf-8");
			return {
				format: "module",
				source: `export default ${JSON.stringify(content)};`,
				shortCircuit: true,
			};
		}
		if (suffix === "url") {
			return {
				format: "module",
				source: `export default ${JSON.stringify(cleanUrl)};`,
				shortCircuit: true,
			};
		}
	} catch (err) {
		console.warn(`[raw-loader] 无法加载 ${cleanUrl}: ${err.message}`);
	}
	return nextLoad(url, context);
}
