/**
 * 实验环境开关（lab mode）的输入解析。
 *
 * 上游工具链靠磁盘标志文件 + 前缀口令切换工作环境；面板把它落到插件私有存储，
 * 所以状态跟着插件走、跨会话/换模型都不丢。这里只做纯字符串解析，
 * 持久化由 `features/workbench/services/lab.ts` 负责，两者都能单测。
 */

export type LabAction = "enter" | "exit" | "none";

export interface LabCommand {
	action: LabAction;
	/** 去掉开关口令之后剩下的部分，用户可以直接跟任务。 */
	rest: string;
}

const ENTER = /^(?:lab|LAB)\s*[:：]\s*/;
const ENTER_ZH = /^(?:进入实验|实验环境|进入工作环境)\s*[:：]?\s*/;
const EXIT = /^(?:退出实验|退出工作环境|exit\s+lab)\s*$/i;

/**
 * `lab： 分析这个 apk` → { enter, "分析这个 apk" }
 * `退出实验` → { exit, "" }
 * 其余原样透传，日常聊天零干扰。
 */
export function parseLabCommand(prompt: string): LabCommand {
	const text = prompt.trim();
	if (EXIT.test(text)) return { action: "exit", rest: "" };
	const match = ENTER.exec(text) ?? ENTER_ZH.exec(text);
	if (!match) return { action: "none", rest: prompt };
	return { action: "enter", rest: text.slice(match[0].length) };
}

export interface LabState {
	enabled: boolean;
	/** ISO 时间戳；关闭时为 null。 */
	since: string | null;
}

export const LAB_OFF: LabState = { enabled: false, since: null };

export function labAfter(state: LabState, command: LabCommand, now: string): LabState {
	if (command.action === "enter") return { enabled: true, since: state.since ?? now };
	if (command.action === "exit") return LAB_OFF;
	return state;
}
