import { useEffect, useState } from "react";

/**
 * 元素**实测**宽度落在第几档。
 *
 * 从前这件事交给 CSS 容器查询（`@max-[1120px]:hidden`）。`@container` 祖先确实在（`StudioShell`），
 * 问题是它量的 **整个壳**，而表格只占其中一块：右侧侧栏一收一放，同一个壳宽下表格能差一整条
 * 侧栏的宽度，按壳宽分档就一定错位——要么六列挤进 300px（书名与徽章逐字换行），要么两列白宽。
 * 量表格自己就没有这个偏差。
 * 量的是 **border box**：`getBoundingClientRect()` 与 ResizeObserver 回调里都取同一个口径。
 * 混用 `contentRect`（不含 padding）与 `getBoundingClientRect`（含）会让同一个宽度在挂载时
 * 与拖动后落进两个档位——表头还有 `px-3`，差值 24px，正好够跨过一个阈值。
 *
 * 交出去的是**档位下标**而不是像素。拖拽分隔条时宽度每帧都在变，下标只在跨过阈值时变一次，
 * 不会让整张表跟着每一帧重画。
 *
 * `bounds` 必须从宽到窄排列：第一个满足 `width >= bound` 的下标即命中，兜底是最窄的一档。
 */
export function useWidthTier(bounds: readonly number[]) {
	const [element, setElement] = useState<HTMLElement | null>(null);
	const [tier, setTier] = useState(bounds.length - 1);

	useEffect(() => {
		if (!element) return;
		const apply = (next: number) => {
			// 宽度为 0 表示还没布局或宿主里被隐藏；此时写状态只会闪一帧窄档。
			if (next <= 0) return;
			const index = bounds.findIndex((bound) => next >= bound);
			setTier(index === -1 ? bounds.length - 1 : index);
		};
		apply(element.getBoundingClientRect().width);
		const observer = new ResizeObserver(() => {
			// 回调里不读 `contentRect`：那是 content box，与上面差一个 padding 的量。
			apply(element.getBoundingClientRect().width);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [element, bounds]);

	return { ref: setElement, tier };
}
