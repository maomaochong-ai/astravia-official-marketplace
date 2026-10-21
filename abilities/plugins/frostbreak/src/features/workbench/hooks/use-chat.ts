import { useTranslation } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkbenchBridge } from "../bridge";
import type { ChatState } from "../state";

export interface ChatModel {
	state: ChatState;
	/** 一次发送还没拿到回执。 */
	sending: boolean;
	/** 把一句英文指令送进对话，并把回执翻成一句提示。 */
	ask(prompt: string): void;
}

const INITIAL: ChatState = { status: "disconnected", tool: null, cwd: null };

export function useChat(bridge: WorkbenchBridge, cwd: string | null): ChatModel {
	const { t } = useTranslation();
	const [state, setState] = useState<ChatState>(INITIAL);
	const [sending, setSending] = useState(false);
	const alive = useRef(true);

	useEffect(() => {
		alive.current = true;
		let unsubscribe = () => {};
		try {
			unsubscribe = bridge.subscribeChat(next => {
				if (alive.current) setState(next);
			});
		} catch (error) {
			// 订阅被权限拒绕时只能看到「未连接」，但面板本身必须活下来。
			console.warn("[frostbreak] chat subscription failed", error);
		}
		return () => {
			alive.current = false;
			unsubscribe();
		};
	}, [bridge]);

	const ask = useCallback(
		(prompt: string) => {
			if (!cwd) {
				bridge.notify(t("chat.noWorkspace"), "warning");
				return;
			}
			setSending(true);
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

	return { state, sending, ask };
}
