/**
 * `@types/react` 已经声明了 `<webview>` 的 intrinsic 与 `HTMLWebViewElement`，
 * 但没有 Electron 运行时的方法。这里只把本插件用到的子集合并进去：
 * 导航、读取当前地址、刷新，以及读页面 / 截图 / 发真实输入这三件事
 * （即 `domain/boardmix-primitive.ts` 检测的那三个）。
 * 属性（`partition` / `allowpopups` / `src`）无需再声明。
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
		/** 在访客页里求值；返回值必须可序列化。 */
		executeJavaScript(code: string): Promise<unknown>;
		/** 截访客页可见区域，返回 Electron 的 NativeImage。 */
		capturePage(): Promise<unknown>;
		/** 把输入事件送进访客页；坐标是访客页视口的 CSS 像素。 */
		sendInputEvent(event: unknown): void;
	}
}

export {};
