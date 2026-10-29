import { useCallback, useState } from "react";

export type LibrarySurface = "shelf" | "catalog" | "book" | "reader" | "ledger";

export interface LibraryRoute {
	surface: LibrarySurface;
	/** 阅读页与书页都带着它，返回时不必再问一次「刚才看的是哪本」。 */
	bookId: string | null;
	/** 只有阅读页有章序；书页回退时保留，方便「回到目录再看刚才那章」。 */
	chapter: number | null;
}

const AT_SHELF: LibraryRoute = { surface: "shelf", bookId: null, chapter: null };

/**
 * 视图内的五层导航（ADR 0013 §2.1 / 0020 §1 / 0026 §1）。不写宿主路由，也不写存储：
 * 侧栏位置不该随「上次读到哪」漂移，阅读位置是会话内的事。
 */
export function useLibraryRoute() {
	const [route, setRoute] = useState<LibraryRoute>(AT_SHELF);

	const openShelf = useCallback(() => setRoute(AT_SHELF), []);

	/** 书库：只换层，不带书目——它是「按条件过一遍」的入口，不是某本书的页面（ADR 0020 §1）。 */
	const openCatalog = useCallback(() => {
		setRoute({ surface: "catalog", bookId: null, chapter: null });
	}, []);

	const openBook = useCallback((bookId: string) => {
		setRoute({ surface: "book", bookId, chapter: null });
	}, []);

	const openChapter = useCallback((bookId: string, chapter: number) => {
		setRoute({ surface: "reader", bookId, chapter });
	}, []);

	/** 伏笔账本：挂在某本书下面（它的台账、决策、体检都按 bookId 存）。 */
	const openLedger = useCallback((bookId: string) => {
		setRoute({ surface: "ledger", bookId, chapter: null });
	}, []);

	/** 回目录：只退一层，书还是那本书。 */
	const backToBook = useCallback(() => {
		setRoute((previous) =>
			previous.bookId === null
				? AT_SHELF
				: { surface: "book", bookId: previous.bookId, chapter: previous.chapter },
		);
	}, []);

	return { route, openShelf, openCatalog, openBook, openChapter, openLedger, backToBook };
}
