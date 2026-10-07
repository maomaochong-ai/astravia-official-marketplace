/**
 * node:test 的源码加载钩子。
 *
 * 1. resolve：源码里存在两种导入风格 —— 显式 `.ts`（如 use-connection-editor.ts）
 *    与省略扩展名（交给打包器，如 workbench-reducer.ts）。Node ESM 不做扩展名补全，
 *    省略风格会让 feature 层模块在测试里无法 import，故此处按 .ts → .tsx → /index.ts
 *    的顺序补一次。
 * 2. load：用 esbuild 把 JSX/TSX 转成 ESM。--experimental-strip-types 只处理 .ts，
 *    遇到 .tsx 会抛 ERR_UNKNOWN_FILE_EXTENSION，组件测试需要直接 import 组件，故在此补齐。
 *    仅接管 .tsx，其余（含 .ts 类型擦除）交给链条上的默认处理。
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { transform } from "esbuild";

const TS_CANDIDATES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
	const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
	// 跳过带 query 的路径（?raw/?url 由 raw-loader 处理）
	const hasQuery = /\?/.test(specifier);
	if (isRelative && !hasQuery && context.parentURL && !/\.[cm]?[jt]sx?$/.test(specifier)) {
		for (const ext of TS_CANDIDATES) {
			const candidate = new URL(specifier + ext, context.parentURL);
			if (existsSync(fileURLToPath(candidate))) return nextResolve(specifier + ext, context);
		}
	}
	return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
	if (/\.tsx($|\?)/.test(url)) {
		const result = await nextLoad(url, { ...context, format: "module" });
		const raw =
			typeof result.source === "string"
				? result.source
				: Buffer.from(result.source).toString("utf8");
		const transformed = await transform(raw, {
			loader: "tsx",
			jsx: "automatic",
			format: "esm",
			target: "node20",
			sourcemap: "inline",
		});
		return { format: "module", source: transformed.code, shortCircuit: true };
	}
	return nextLoad(url, context);
}
