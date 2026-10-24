/**
 * 把样本交给宿主对话框里的 Agent 分析。
 *
 * 为什么需要它：宿主的单次二进制读取上限是 32 MiB，插件没有范围读、没有流式读，
 * 超过这个尺寸的样本在面板里永远打不开。Agent 不是走同一条 IPC——它用自己的 `read` / `bash`
 * 在真实路径上跑 `sha256sum` / `file` / `strings`，所以这是超大文件唯一能全量分析的通道。
 *
 * 提示词固定中文：它进的是宿主 Agent 的上下文，用户要的是「点一下就能发、还能改」。
 */

export type HandoffReason = "too-large" | "outside-project" | "other" | null;

export interface HandoffTarget {
	/** 样本在磁盘上的真实路径。 */
	path: string;
	size?: number | null;
	/** 面板为什么打不开它；null 表示用户只是想让 Agent 一起看。 */
	reason: HandoffReason;
}

/** 用户可编辑的问题区默认内容。 */
export const HANDOFF_QUESTION = "先给结论：这是什么文件、有没有明显风险，再按证据展开。";

function describeSize(size: number | null | undefined): string | null {
	if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return null;
	const mib = size / 1024 / 1024;
	if (mib >= 1) return `${mib.toFixed(1)} MiB`;
	return `${(size / 1024).toFixed(1)} KiB`;
}

function reasonLine(target: HandoffTarget): string {
	const size = describeSize(target.size);
	switch (target.reason) {
		case "too-large":
			return `它的大小是 ${size ?? "未知"}，超过宿主给插件的 32 MiB 单次读取上限，面板的引擎打不开它。`;
		case "outside-project":
			return "它不在当前工作区里，宿主只允许插件读工作区内的路径，面板的引擎打不开它。";
		case "other":
			return "面板的引擎没能打开它。";
		default:
			return size ? `它的大小是 ${size}。` : "";
	}
}

/** 预填进对话框的完整提示词；用户改完再发。 */
export function buildHandoffPrompt(target: HandoffTarget, question = HANDOFF_QUESTION): string {
	const lines = [`请分析这个样本：${target.path}`];
	const reason = reasonLine(target);
	if (reason) lines.push(reason);
	lines.push(
		"请直接在它所在的真实路径上静态分析：算哈希、识别文件格式与内部条目、把值得注意的字符串（URL、主机、脚本名、内嵌可执行文件、凭据迹象）挑出来，每条结论都标注证据来源。",
		"不要执行这个样本，也不要把它改造成可执行文件。看不到的部分直接说明看不到。",
	);
	if (question.trim().length > 0) lines.push("", question.trim());
	return lines.join("\n");
}
