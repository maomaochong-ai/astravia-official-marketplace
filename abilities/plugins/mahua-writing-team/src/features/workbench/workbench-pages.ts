/**
 * 七帧的标识与窄栏结构。
 *
 * 帧的清单来自设计稿（ui-mock/mahua-novel-studio）：书架、书库、书页、阅读、伏笔与决策、
 * 运行台、激活。这里只放"哪一帧叫什么、在哪一组里"，不放任何界面代码——窄栏与页头都从
 * 这份表读，改一处两处一起变。
 */

export type WorkbenchPage = "shelf" | "library" | "book" | "reader" | "ledger" | "console" | "activation";

/** 当前在哪一帧，以及阅读页要读哪一章。 */
export interface WorkbenchRoute {
	page: WorkbenchPage;
	chapter?: number;
}

export interface RailItem {
	page: WorkbenchPage;
	labelKey: string;
	icon: string;
}

/** 「在写的这本」下面的一组：看书用的四条路径。 */
export const RAIL_WORKS: readonly RailItem[] = [
	{ page: "shelf", labelKey: "nav.shelf", icon: "icon-[solar--library-bold]" },
	{ page: "library", labelKey: "nav.library", icon: "icon-[solar--layers-bold]" },
	{ page: "book", labelKey: "nav.book", icon: "icon-[solar--book-bold]" },
	{ page: "reader", labelKey: "nav.reader", icon: "icon-[solar--document-text-bold]" },
];

/** 「写作台」那一组：只看不写的两张纸。 */
export const RAIL_CRAFT: readonly RailItem[] = [
	{ page: "console", labelKey: "nav.console", icon: "icon-[solar--pulse-bold]" },
	{ page: "ledger", labelKey: "nav.ledger", icon: "icon-[solar--branching-paths-up-bold]" },
];

export function pageTitleKey(page: WorkbenchPage): string {
	return `page.${page}.title`;
}

/** 只有激活页脱离窄栏——它自己就是整张纸。运行台不是：设计稿那一帧带着侧栏。 */
export function isBarePage(page: WorkbenchPage): boolean {
	return page === "activation";
}
