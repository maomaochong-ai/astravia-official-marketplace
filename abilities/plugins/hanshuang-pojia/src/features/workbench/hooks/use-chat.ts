import { useTranslation } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkbenchBridge } from "../bridge";
import type { ChatState } from "../state";

export interface ChatModel {
	state: ChatState;
	/** 一次发送还没拿到回执。 */
	sending: boolean;
	/** 最近一次投进对话的原话：案例溯源用它，不靠调用点再传一遍。 */
	lastPrompt: string | null;
	/** 把一句英文指令送进对话，并把回执翻成一句提示。 */
	ask(prompt: string): void;
}

const INITIAL: ChatState = { status: "disconnected", sessionId: null, tool: null, cwd: null };

export function useChat(bridge: WorkbenchBridge, cwd: string | null, enabled = true): ChatModel {
	const { t } = useTranslation();
	const [state, setState] = useState<ChatState>(INITIAL);
	const [sending, setSending] = useState(false);
	const [lastPrompt, setLastPrompt] = useState<string | null>(null);
	const alive = useRef(true);

	// 订阅只建一次（bridge 不进依赖），并在同值时不产生新引用：宿主在订阅时会立刻 replay
	// 一次 conversation-changed，如果每次都 setState 一个新对象，面板就会被无休止地重渲染。
	const bridgeRef = useRef(bridge);
	bridgeRef.current = bridge;
	const latest = useRef<ChatState>(INITIAL);
	useEffect(() => {
		alive.current = true;
		// 面板不在前台时不订阅宿主会话：宿主每发一条 turn/tool 事件都会进来一次，
		// 没人看的界面不该跟着它重渲染。切到前台时宿主会 replay 一次当前状态。
		if (!enabled) {
			return () => {
				alive.current = false;
			};
		}
		let unsubscribe = () => {};
		try {
			unsubscribe = bridgeRef.current.subscribeChat(next => {
				if (!alive.current) return;
				const previous = latest.current;
				// 去重必须包含 sessionId：新建会话时 status / tool / cwd 往往一模一样，
				// 只比这三个字段就等于「换会话了但面板不知道」，上一个会话的样本会留在新会话首屏。
				const same =
					previous.status === next.status &&
					previous.tool === next.tool &&
					previous.cwd === next.cwd &&
					previous.sessionId === next.sessionId;
				if (same) return;
				latest.current = next;
				setState(next);
			});
		} catch (error) {
			// 订阅被权限拒绕时只能看到「未连接」，但面板本身必须活下来。
			console.warn("[hanshuang-pojia] chat subscription failed", error);
		}
		return () => {
			alive.current = false;
			unsubscribe();
		};
	}, [enabled]);

	const ask = useCallback(
		(prompt: string) => {
			if (!cwd) {
				bridge.notify(t("chat.noWorkspace"), "warning");
				return;
			}
			setSending(true);
			setLastPrompt(prompt);
			bridge
				.chat(prompt, cwd)
				.then(outcome => {
					if (!alive.current) return;
					const key = outcome === "sent" ? "chat.sent" : outcome === "queued" ? "chat.queued" : "chat.opened";
					bridge.notify(t(key), outcome === "queued" ? "info" : "success");
				})
				.catch((failure: unknown) => {
					if (!alive.current) return;
					const message = failure instanceof Error ? failure.message : String(failure);
					bridge.notify(t("chat.failed", { message }), "error");
				})
				.finally(() => {
					if (alive.current) setSending(false);
				});
		},
		[bridge, cwd, t],
	);

	return { state, sending, lastPrompt, ask };
}
