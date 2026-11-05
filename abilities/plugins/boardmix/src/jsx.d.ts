/**
 * `@types/react` 已经声明了 `<webview>` 的 intrinsic 与 `HTMLWebViewElement`，
 * 但没有 Electron 运行时的方法。这里只把本插件用到的子集合并进去：
 * 导航、读取当前地址、刷新。属性（`partition` / `allowpopups` / `src`）无需再声明。
 */
declare global {
	interface HTMLWebViewElement extends HTMLElement {
		src: string;
		partition?: string;
		allowpopups?: boolean;
		getURL(): string;
		loadURL(url: string): Promise<void>;
		reload(): void;
		stop(): void;
		goBack(): void;
		goForward(): void;
		canGoBack(): boolean;
		canGoForward(): boolean;
	}
}

export {};
