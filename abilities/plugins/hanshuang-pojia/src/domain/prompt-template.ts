/**
 * 系统提示词模板：`agent/prompts/SYSTEM.md` 的原文，一键注入到提示词库。
 *
 * 为什么单独一个文件：模板的身份（名称、注入模式）是产品决定，正文是权威母本。
 * 正文由 `scripts/sync-system-prompt.mjs` 从母本生成到 `SYSTEM_PROMPT_BODY`，这里只引用——
 * 再抄一份正文，两份迟早不一致，而用户看不出哪份是真的。
 */

import { SYSTEM_PROMPT_BODY } from "./system-prompt.generated";

export interface PromptTemplate {
	id: string;
	name: string;
	description: string;
	content: string;
	mode: "append" | "prepend" | "override";
}

/** 与注入模式配套：系统契约是「前置」——它必须先于用户那句话成立。 */
export const SYSTEM_PROMPT_TEMPLATE: PromptTemplate = {
	id: "template:system-prompt",
	name: "寒霜破甲 · 系统契约",
	description: "SYSTEM.md 原文，原封不动；建议 prepend 注入。",
	content: SYSTEM_PROMPT_BODY,
	mode: "prepend",
};

/** 模板是否已经在库里：按正文比对，用户改过名称也算「已有」。 */
export function hasSystemTemplate(items: readonly { content: string }[]): boolean {
	const body = SYSTEM_PROMPT_BODY.trim();
	return items.some((item) => item.content.trim() === body);
}
