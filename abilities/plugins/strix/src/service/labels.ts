// 清单里的 `%key%` 要在两个地方各解一次，而且两边语言不同：
//   · 面板——按宿主语言解（用户看）；
//   · 服务——按提示词语言解（模型看）。服务没有 i18n 上下文，只能读随包的 locales/*.json。
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Labels = Readonly<Record<string, string>>;

/** 读随包的文案表；缺文件就返回空表（调用方原样回传 `%key%`，不编字）。 */
export function loadLabels(pluginRoot: string, lang = "zh"): Labels {
	try {
		return JSON.parse(readFileSync(join(pluginRoot, "locales", `${lang}.json`), "utf8")) as Record<string, string>;
	} catch {
		return {};
	}
}

/** 把 `%key%` 换成文案；不是占位符、或者表里没有这个键，就原样返回（宁可露键名，也不露空串）。 */
export function resolveLabel(labels: Labels, value: unknown): string {
	const text = String(value ?? "").trim();
	const wrapped = /^%(.+)%$/.exec(text);
	if (!wrapped) return text;
	return labels[wrapped[1]] ?? text;
}
