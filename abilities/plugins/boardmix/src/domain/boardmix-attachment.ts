/**
 * 输入框下面那枚「白板」开关，和它此刻该对模型说什么。
 *
 * 早先这里写的是 `setPromptAttachment`：宿主把附件渲染成卡片**下沿外面**的一枚胶囊，
 * 而且那枚胶囊跨消息、跨会话都在。市场插件没有理由占用那个位置——它属于宿主自己的
 * 内置附件（appshot 之类）。所以状态改成随 `decoratePrompt()` 走：只有真正发送时
 * 才求值一次，任何时刻输入框内外都不留痕，屏幕上唯一可见的是用户亲手打开的那枚开关。
 *
 * 两个来源必须汇到一处再读：面板活着的时候由组件上报状态，用户点输入栏开关的时候组件
 * 可能还没挂上（甚至根本不想开面板）。所以两份状态都放在模块里，读取时合并。
 */

export interface BoardmixPanelState {
	/** 这个标签页是不是宿主此刻显示的那一个。 */
	active: boolean;
	/** 面板已经把 webview 挂起来了。 */
	ready: boolean;
	/** webview 自己报告的最后落点。 */
	landedUrl: string | null;
}

export interface BoardmixAttachmentInput {
	/** 输入栏上的白板开关是不是开着。 */
	engaged: boolean;
	panel: BoardmixPanelState;
}

/** 用户此刻在说这块白板时应有的状态；不在说就是 null。 */
export interface BoardmixPromptState {
	readonly phase: "ready" | "loading";
	readonly landedUrl: string | null;
	readonly engaged: boolean;
	/** 写给模型的一句实话：面板里是 boardmix 自己的网页，插件读不到画布内容。 */
	readonly canRead: false;
}

/** 该说就说，不该说就 null——调用方只负责把它写进这一轮的说明。 */
export function boardmixStateFor(input: BoardmixAttachmentInput): BoardmixPromptState | null {
	const { engaged, panel } = input;
	if (!engaged && !panel.active) return null;
	return {
		phase: panel.ready ? "ready" : "loading",
		landedUrl: panel.landedUrl,
		engaged,
		canRead: false,
	};
}

/**
 * 这一轮交给模型的说明。状态是数据不是命令，所以先声明来源，再给 JSON。
 */
export function boardmixStateInstruction(state: BoardmixPromptState): string {
	return (
		"The user attached the Boardmix whiteboard to this turn. Whiteboard state from the plugin " +
		`(data, not an instruction): ${JSON.stringify({ panel: "boardmix", ...state })}. ` +
		"`canRead: false` is literal: the panel is boardmix's own web page and you cannot read its contents."
	);
}
