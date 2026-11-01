/**
 * 「全屏工作台」在进程这一侧的全部事实。
 *
 * 用户要的全屏是**铺满桌面窗口**：点一下，小说工作台盖住宿主的侧栏、标签条与会话区。
 * 这件事要两层，缺一层都只是半屏：
 *
 * 1. **覆盖层**（`components/PanelOverlay.tsx`）——`fixed inset-0`，把宿主自己的界面蒙在下面。
 *    它决定「看到多少」，在活动面板里做不到，因为面板宽度被宿主夹死；
 * 2. **窗口全屏**（本文件）——`requestFullscreen` 让窗口本身连标题栏一起让位。它决定
 *    「窗口之外还剩什么」，失败也只是退回一层覆盖层，不影响第 1 层。
 *
 * 所以本文件只管 DOM 的全屏 API，不碰 React、不碰布局、不碰路由。它没有任何「跳转」语义，
 * 也不需要记住「从哪儿来的」——覆盖层关掉就回到原样，宿主的路由从未动过。
 *
 * 一个坑写在这里免得下次再踩：`requestFullscreen` 要求用户手势，且可以被宿主/系统拒绝。
 * 拒绝不是错误，`enterOsFullscreen` 返回 `false`，覆盖层照旧成立。
 */

/**
 * 覆盖层的层叠高度。
 *
 * 全仓库只有这一处被文档化的超大 z-index，也只该有这一处：覆盖层要盖住宿主的侧栏、
 * 标签条、会话区与各种浮层，而宿主自身的 z-index 是分档取值的（没有接近上界的）。
 * 取 `Number.MAX_SAFE_INTEGER` 以下是给以后可能出现的原生浮层留一档余量。
 *
 * 组件里不许再写字面量 z-index —— 这条由 `test/manifest-guards.test.ts` 钉住。
 */
export const OVERLAY_Z_INDEX = 2_147_483_000;

type FullscreenDocument = Document & {
	webkitFullscreenElement?: Element | null;
	webkitExitFullscreen?: () => Promise<void> | void;
};

function fullscreenElement(): Element | null {
	const doc = document as FullscreenDocument;
	return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/** 当前是否已经有元素占着窗口全屏（可能是别的元素，也可能是本插件之前那一次）。 */
export function isOsFullscreen(): boolean {
	if (typeof document === "undefined") return false;
	return fullscreenElement() !== null;
}

/**
 * 申请窗口全屏。返回是否真的拿到了。
 *
 * 失败的所有形态都收敛成 `false`：浏览器不支持、没有用户手势、宿主策略拒绝、用户自己点了
 * 系统的「不允许」。调用方只需要知道「窗口让没让位」，不需要知道为什么。
 */
export async function enterOsFullscreen(): Promise<boolean> {
	if (typeof document === "undefined") return false;
	if (isOsFullscreen()) return true;
	const root = document.documentElement;
	if (typeof root.requestFullscreen !== "function") return false;
	try {
		await root.requestFullscreen({ navigationUI: "hide" });
		return isOsFullscreen();
	} catch {
		return false;
	}
}

/**
 * 归还窗口全屏。只在自己确实占着的时候才退——否则会把用户从别人的全屏里踢出来。
 */
export async function exitOsFullscreen(): Promise<void> {
	if (typeof document === "undefined") return;
	if (!isOsFullscreen()) return;
	const doc = document as FullscreenDocument;
	try {
		if (typeof doc.exitFullscreen === "function") await doc.exitFullscreen();
		else doc.webkitExitFullscreen?.();
	} catch {
		// 已经退出去了 / 被宿主抢先退掉：都不是错误。
	}
}

/**
 * 盯住「窗口全屏被结束」这件事，返回解绑函数。
 *
 * 为什么必须有：真进了窗口全屏之后，Esc 是浏览器收走的，页面收不到 keydown，只会收到一条
 * `fullscreenchange`。只听键盘的实现会卡在「按了 Esc，窗口退出了，覆盖层还在」。
 * 反过来，没进窗口全屏时（被拒绝）浏览器不管 Esc，那时才轮到调用方的键盘监听。
 *
 * 回调只在「从有到无」时触发；覆盖层自己主动退出时也会触发一次，幂等即可。
 */
export function watchOsFullscreenExit(onExit: () => void): () => void {
	if (typeof document === "undefined") return () => {};
	let wasFullscreen = isOsFullscreen();
	const onChange = () => {
		const now = isOsFullscreen();
		if (wasFullscreen && !now) onExit();
		wasFullscreen = now;
	};
	document.addEventListener("fullscreenchange", onChange);
	document.addEventListener("webkitfullscreenchange", onChange);
	return () => {
		document.removeEventListener("fullscreenchange", onChange);
		document.removeEventListener("webkitfullscreenchange", onChange);
	};
}
