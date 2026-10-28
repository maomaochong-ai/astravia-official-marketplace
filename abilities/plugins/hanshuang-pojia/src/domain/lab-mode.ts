/**
 * 实验环境开关（lab mode）的输入解析。
 *
 * 上游工具链靠磁盘标志文件 + 前缀口令切换工作环境；面板把它落到插件私有存储，
 * 所以状态跟着插件走、跨会话/换模型都不丢。这里只做纯字符串解析，
 * 持久化由 `features/workbench/hooks/use-lab.ts` 负责，两者都能单测。
 *
 * 解析必须**宽进**：口诀打错一个冒号就打不开环境，模型于是照常拒答，
 * 用户看到的却是「这个插件不管用」。因此 `lab`、`lab:`、`lab：`、`/lab`、
 * `lab 任务`、大小写混写、中文三种说法都算进入；`退出实验`/`exit lab`/`lab off` 都算退出。
 * 误判的方向也要选对：多开一次环境只是多一份上下文，少开一次则整轮白问。
 */

export type LabAction = "enter" | "exit" | "none";

export interface LabCommand {
	action: LabAction;
	/** 去掉开关口令之后剩下的部分，用户可以直接跟任务。 */
	rest: string;
}

/**
 * 英文/斜杠形式：`lab`、`/lab`、`lab:`、`lab：`、`lab 任务`。
 * `\b` 那一步是给 `laboratory` 这类词留的：后面必须紧跟冒号、空白或行尾。
 */
const ENTER = /^(?:\/)?lab(?:\s*[:：]\s*|\s+|$)/i;

/**
 * 中文形式：可以带「进入/开启/打开」，也可以直接说「实验环境/工作模式」。
 * 不加可选前缀就会把「工作的进展」读成开关——这里要求动词或尾缀二者必居其一。
 */
const ENTER_ZH = /^(?:(?:进入|开启|打开|切换到?)\s*(?:实验|工作)(?:环境|模式)?|(?:实验|工作)(?:环境|模式))\s*[:：]?\s*/;

/** 退出：中英各两种说法，`lab off` 与 `/lab off` 也算。 */
const EXIT = /^(?:(?:退出|关闭|离开)\s*(?:实验|工作)(?:环境|模式)?|(?:exit|quit)\s+lab|\/lab\s+(?:off|exit)|lab\s+(?:off|exit))\s*$/i;

/**
 * `lab： 分析这个 apk` → { enter, "分析这个 apk" }
 * `lab` → { enter, "" }（只开环境，任务下一轮说）
 * `退出实验` → { exit, "" }
 * 其余原样透传，日常聊天零干扰。
 */
export function parseLabCommand(prompt: string): LabCommand {
	const text = prompt.trim();
	if (EXIT.test(text)) return { action: "exit", rest: "" };
	const match = ENTER.exec(text) ?? ENTER_ZH.exec(text);
	if (!match) return { action: "none", rest: prompt };
	return { action: "enter", rest: text.slice(match[0].length).trim() };
}

export interface LabState {
	enabled: boolean;
	/** ISO 时间戳；关闭时为 null。 */
	since: string | null;
}

export const LAB_OFF: LabState = { enabled: false, since: null };

/**
 * 开关状态机。重复进入保留第一次的时间戳——「什么时候开的」是可追溯的事实，
 * 不能被后面每句 `lab：` 冲掉；没有口令时状态原样返回，不写盘。
 */
export function labAfter(state: LabState, command: LabCommand, now: string): LabState {
	if (command.action === "enter") return { enabled: true, since: state.since ?? now };
	if (command.action === "exit") return LAB_OFF;
	return state;
}
