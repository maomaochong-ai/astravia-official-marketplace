/**
 * 输入框下面那个胶囊说什么，是纯函数。
 *
 * 它有两个来源，`engaged`（用户点了输入栏上的白板开关）与面板自己的状态（打开了、加载完、落在哪）。
 * 两者合并成一条规则：**只要用户此刻在说这块白板，就挂上；否则摘掉。**
 *
 * `canRead: false` 是写给模型看的一句实话：面板里是 boardmix 自己的网页，插件读不到画布内容。
 * 它不能因为输入框下面挂着这个名字就以为自己看见了白板。
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
	/** 胶囊上显示的名字，通常是标签页标题。 */
	label: string;
}

export interface BoardmixPromptAttachment {
	id: string;
	label: string;
	lifecycle: "sticky";
	context: {
		schema: string;
		version: number;
		payload: {
			panel: "boardmix";
			phase: "ready" | "loading";
			landedUrl: string | null;
			engaged: boolean;
			canRead: false;
		};
	};
}

export const ATTACHMENT_ID = "boardmix:panel";
export const ATTACHMENT_SCHEMA = "astravia.boardmix.panel-state";

/** 该挂就返回胶囊，不该挂就 null——调用方只负责把它交给宿主。 */
export function boardmixAttachmentFor(input: BoardmixAttachmentInput): BoardmixPromptAttachment | null {
	const { engaged, panel, label } = input;
	if (!engaged && !panel.active) return null;
	return {
		id: ATTACHMENT_ID,
		label: label.trim() || "Boardmix",
		lifecycle: "sticky",
		context: {
			schema: ATTACHMENT_SCHEMA,
			version: 1,
			payload: {
				panel: "boardmix",
				phase: panel.ready ? "ready" : "loading",
				landedUrl: panel.landedUrl,
				engaged,
				canRead: false,
			},
		},
	};
}
