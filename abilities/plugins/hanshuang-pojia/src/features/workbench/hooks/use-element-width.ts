import { useEffect, useRef, useState } from "react";

/**
 * 量一个元素的内容宽度。
 *
 * 面板是可拖拽的活动栏 tab，宽度由用户决定，`window.innerWidth` 给不了这个数
 * （容器查询能画样式，但侧栏要不要收成图标轨需要 JS 判断）。
 * ResizeObserver 只在尺寸真的变了时才回调，所以这里不做节流也不会打满渲染。
 */
export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
	const ref = useRef<T | null>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		setWidth(node.getBoundingClientRect().width);
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(entries => {
			const entry = entries[0];
			if (entry) setWidth(entry.contentRect.width);
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	return [ref, width];
}
