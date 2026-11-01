import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 把子树送到 `document.body` 上，并且**自己就是插件样式的作用域根**。
 *
 * 为什么不能在原地把画面放大：宿主的活动面板有宽度模型（留 384px 给会话区），而且不管
 * 插件把 z-index 抬多高，面板自身就在宿主的层叠上下文里——盖不住侧栏、标签条与会话区。
 * 只有一个 `position: fixed` 且挂在 body 下的元素才真正铺满窗口。
 *
 * 为什么必须带 `data-astravia-plugin-root`：本插件的 CSS 全部编译进
 * `@scope ([data-astravia-plugin-root=mahua-writing-team])`，`@scope` 只匹配作用域根的**后代**。
 * 一个裸 div 挂到 body 上，它和它下面的一切都拿不到插件样式——连 Tailwind 的 `fixed`
 * 都不会生效（宿主自己的 Tailwind 里没有这个类）。
 *
 * 为什么根上不许挂 class、并且要 `display: contents`：
 *
 * - 根自身不在 `@scope` 的匹配范围内，根上的类会静默失效。踩过的坑是给根写了
 *   `fixed inset-0 z-[1010]`，前两个类宿主恰好也有所以看着没问题，只有 `z-[1010]` 一点效果
 *   都没有——表象是「点了只有蒙层」，弹窗被下层盖住。
 * - 根只要还是个盒子，它就会成为 `fixed` 子元素的定位上下文与布局盒；`contents` 让它
 *   从布局里彻底消失，子元素的 `inset-0` 才是相对视口。
 *
 * 这两个约束由 `test/manifest-guards.test.ts` 钉住（全仓只允许本文件写出作用域根属性）。
 */
export function PanelOverlay({ children }: { children: ReactNode }) {
	if (typeof document === "undefined") return <>{children}</>;
	return createPortal(
		<div data-astravia-plugin-root="mahua-writing-team" style={{ display: "contents" }}>
			{children}
		</div>,
		document.body,
	);
}
