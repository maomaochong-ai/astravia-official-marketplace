/**
 * node:test 的 .tsx 加载钩子：用 esbuild 把 JSX/TSX 转成 ESM。
 *
 * --experimental-strip-types 只处理 .ts，遇到 .tsx 会抛 ERR_UNKNOWN_FILE_EXTENSION；
 * 组件测试需要直接 import 组件，故在此补齐。仅接管 .tsx，其余（含 .ts 类型擦除）
 * 交给链条上的默认处理。
 */

import { transform } from "esbuild";

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
