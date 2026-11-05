/**
 * `<webview>` 在导航之外还给的三个原生能力，全部在调用时做能力检测。
 *
 * 这个插件此前对模型说的是「你读不到、点不到画布」，那是因为当时只用了
 * `loadURL` / `getURL`。宿主开着 `webviewTag`，于是访客页本身提供了
 * `executeJavaScript`（读 DOM）、`capturePage`（带登录态截一张图）和
 * `sendInputEvent`（真实鼠标键盘）。三者都是访客页面的真实输入，
 * 因此它们看到的就是用户看到的，没有第二套「模拟」实现。
 *
 * 检测不到就返回缺口，不假装成功：旧宿主、被策略关掉 webview 的构建、
 * 或者 Electron 某天改了 API，都会落到 `primitive-unavailable`。
 */
export interface WebviewPrimitives {
	/** 在访客页里求值；返回值必须是可序列化的。 */
	run(code: string): Promise<unknown>;
	/** 截访客页可见区域，返回 PNG 的 base64；拿不到就是 null。 */
	shot(): Promise<string | null>;
	/** 真实输入事件：鼠标、键盘、滚轮。返回是否真的发出去了。 */
	input(events: unknown[]): boolean;
	/** 访客页的可见尺寸，用来把坐标说清楚。 */
	viewport(): Promise<{ width: number; height: number } | null>;
}

export type PrimitiveGap = "execute-javascript" | "capture-page" | "send-input-event";

interface PrimitiveHost {
	executeJavaScript?: (code: string) => Promise<unknown>;
	capturePage?: () => Promise<unknown>;
	sendInputEvent?: (event: unknown) => void;
}

/** 哪些能力在这个 webview 实例上真的存在。空数组 = 三个都有。 */
export function missingPrimitives(element: unknown): PrimitiveGap[] {
	const host = (element ?? null) as PrimitiveHost | null;
	const gaps: PrimitiveGap[] = [];
	if (typeof host?.executeJavaScript !== "function") gaps.push("execute-javascript");
	if (typeof host?.capturePage !== "function") gaps.push("capture-page");
	if (typeof host?.sendInputEvent !== "function") gaps.push("send-input-event");
	return gaps;
}

function base64Of(bytes: Uint8Array): string {
	let binary = "";
	const chunk = 0x8000;
	for (let at = 0; at < bytes.length; at += chunk) {
		binary += String.fromCharCode(...bytes.subarray(at, at + chunk));
	}
	return typeof btoa === "function" ? btoa(binary) : "";
}

/** 三个都齐才返回句柄；缺任何一个都返回 null，由调用方去说缺了什么。 */
export function primitivesOf(element: unknown): WebviewPrimitives | null {
	const host = (element ?? null) as PrimitiveHost | null;
	if (missingPrimitives(host).length > 0) return null;
	const run = host?.executeJavaScript;
	const capture = host?.capturePage;
	const send = host?.sendInputEvent;
	if (!run || !capture || !send) return null;

	return {
		run: code => run.call(host, code),
		async shot() {
			const image = (await capture.call(host)) as
				| { toPNG?: () => unknown }
				| Uint8Array
				| null
				| undefined;
			if (!image) return null;
			// Electron 给 NativeImage；个别构建给的是已经编码好的字节。
			if (image instanceof Uint8Array) return base64Of(image);
			const toPNG = (image as { toPNG?: () => unknown }).toPNG;
			if (typeof toPNG !== "function") return null;
			const png = toPNG.call(image) as { toString?: (encoding: string) => string } | Uint8Array | null;
			if (!png) return null;
			if (png instanceof Uint8Array) return base64Of(png);
			return typeof png.toString === "function" ? png.toString("base64") : null;
		},
		input(events) {
			try {
				for (const event of events) send.call(host, event);
				return true;
			} catch {
				return false;
			}
		},
		async viewport() {
			const value = (await run.call(
				host,
				"(() => ({ width: window.innerWidth, height: window.innerHeight }))()",
			)) as { width?: unknown; height?: unknown } | null;
			if (!value || typeof value.width !== "number" || typeof value.height !== "number") return null;
			return { width: Math.round(value.width), height: Math.round(value.height) };
		},
	};
}
