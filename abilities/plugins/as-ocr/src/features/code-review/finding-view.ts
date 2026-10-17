/**
 * 发现的展示元数据：级别/类别的文案与配色、行号、时长与时间格式。
 *
 * 只放「怎么显示」，判断逻辑在 review/finding.ts（词表、归一化、过滤、分组）。
 */

import type { ReviewCategory, ReviewSeverity } from "../../review/finding.ts";

export const SEVERITY_LABEL: Record<ReviewSeverity, string> = {
	critical: "严重",
	high: "高",
	medium: "中",
	low: "低",
};

/** 级别不是装饰：四档各有含义，悬停文案里说明该不该修。 */
export const SEVERITY_HINT: Record<ReviewSeverity, string> = {
	critical: "严重：数据丢失、安全问题或必然崩溃，必须修",
	high: "高：会让真实路径出错，应该修",
	medium: "中：边界情况或可维护性风险，建议修",
	low: "低：细节问题，可选",
};

export const SEVERITY_TONE: Record<ReviewSeverity, string> = {
	critical: "bg-red-500/15 text-red-600 dark:text-red-400",
	high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
	medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
	low: "bg-muted text-muted-foreground",
};

export const CATEGORY_LABEL: Record<ReviewCategory, string> = {
	bug: "缺陷",
	security: "安全",
	performance: "性能",
	maintainability: "可维护性",
	test: "测试",
	style: "风格",
	documentation: "文档",
	other: "其他",
};

/** 行号标签：定位不到时显式说「未定位」，不能显示成 L0。 */
export function lineLabel(line: number, endLine: number): string {
	if (line <= 0) return "未定位";
	return endLine > line ? `L${line}-${endLine}` : `L${line}`;
}

export function formatDuration(ms: number): string {
	if (ms <= 0) return "";
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

export function formatClock(at: number, now: number = Date.now()): string {
	const date = new Date(at);
	const clock = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
	const sameDay = new Date(now).toDateString() === date.toDateString();
	return sameDay ? clock : `${date.getMonth() + 1}/${date.getDate()} ${clock}`;
}

/**
 * 引擎标签：委托模式是模型自己审，ocr 模式是 ocr 调自己的 LLM。
 *
 * 没有 engine 的是 0.1.9 之前的旧记录（那时还没有这两条链路），标成「旧版本」而不是
 * 默认当成 ocr —— 否则旧记录会冒充一次真实的 ocr 运行。
 */
export function engineLabel(engine: "delegate" | "ocr" | undefined): string {
	if (engine === "ocr") return "ocr";
	if (engine === "delegate") return "委托";
	return "旧版本";
}
