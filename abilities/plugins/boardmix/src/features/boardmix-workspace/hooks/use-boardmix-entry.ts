import { useCallback, useEffect, useRef, useState } from "react";
import { readJsonFile, writeJsonFile, type PluginContext } from "@astravia-org/plugin-sdk";
import {
	EMPTY_ENTRY_STATE,
	ENTRY_STATE_PATH,
	readEntryState,
	seedLadder,
	type BoardmixSeed,
	type EntryState,
} from "../../../domain/boardmix-entry";

export interface BoardmixEntry {
	ready: boolean;
	ladder: BoardmixSeed[];
	persistLanded(url: string, landedAt: string): void;
	openExternal(url: string): void;
}

/**
 * 读一次存储、算一次阶梯，之后只往下写。阶梯只在挂载时求值——
 * 页面自己跳转不该把 webview 的 src 改掉。
 */
export function useBoardmixEntry(ctx: PluginContext): BoardmixEntry {
	const [state, setState] = useState<EntryState | null>(null);
	const stateRef = useRef<EntryState | null>(null);
	stateRef.current = state;

	useEffect(() => {
		let alive = true;
		void readJsonFile<unknown>(ctx.storage, ENTRY_STATE_PATH)
			.then(value => {
				if (alive) setState(readEntryState(value));
			})
			.catch(() => {
				// 读不出来就当没有——阶梯自己会退到写死的那两级。
				if (alive) setState(EMPTY_ENTRY_STATE);
			});
		return () => {
			alive = false;
		};
	}, [ctx]);

	const persistLanded = useCallback(
		(url: string, landedAt: string) => {
			const next: EntryState = {
				...(stateRef.current ?? EMPTY_ENTRY_STATE),
				lastGoodUrl: url,
				landedAt,
			};
			stateRef.current = next;
			void writeJsonFile(ctx.storage, ENTRY_STATE_PATH, next).catch(() => {
				// 落库失败不影响这次浏览，下次只是退回工作台根。
			});
		},
		[ctx],
	);

	const openExternal = useCallback(
		(url: string) => {
			void ctx.ui.openExternal(url).catch((error: unknown) => {
				ctx.ui.notify({
					message: String(error instanceof Error ? error.message : error),
					error,
				});
			});
		},
		[ctx],
	);

	const ladder = state ? seedLadder(state) : [];

	return { ready: state !== null, ladder, persistLanded, openExternal };
}
