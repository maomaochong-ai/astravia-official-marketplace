import { useEffect, useState } from "react";
import type { Instruction, NovelBook } from "../../../domain/novel-types.js";
import { routeNovel } from "../../../domain/novel-flow.js";
import { getStudioRuntime } from "../../../plugin-context.js";

export interface NextStep {
	loading: boolean;
	book: NovelBook | null;
	instruction: Instruction | null;
}

/**
 * 新会话上下文区用的只读快照：最近更新的一本书 + 路由算出的下一步。
 * 不复用 `useStudioState`——那套还带选中态、写操作与剪贴板，输入框下方的素材区不需要这些。
 */
export function useNextStep(): NextStep {
	const runtime = getStudioRuntime();
	const service = runtime.service;
	const [state, setState] = useState<NextStep>({ loading: true, book: null, instruction: null });

	useEffect(() => {
		let alive = true;
		void (async () => {
			try {
				const list = await service.listBooks();
				const book = list.ok && list.data[0] ? await service.resolveBook(list.data[0].id) : null;
				if (!alive) return;
				setState({ loading: false, book, instruction: book ? routeNovel(book) : null });
			} catch {
				if (alive) setState({ loading: false, book: null, instruction: null });
			}
		})();
		return () => {
			alive = false;
		};
	}, [service]);

	return state;
}
