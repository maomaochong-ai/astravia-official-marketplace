import { useEffect, useState } from "react";

export type HostMode = "light" | "dark";

/**
 * 宿主的明暗只有一个真源：`document.documentElement` 上的 `data-mode`（`theme/apply.ts`）。
 *
 * 不能写成 `:root[data-mode="dark"] .mahua-root`：插件 CSS 会被 `plugin-vite` 编译进
 * `@scope ([data-astravia-plugin-root=<id>])`，选择器前置的 `:where(:scope)` 要求 `data-mode`
 * 落在插件根的内部，而它挂在 `<html>` 上，位于 scope 之外 —— 深色分支永远不命中，
 * 宿主切主题时工作台一直是那张米纸。
 *
 * 所以模式由 JS 读出来、写到工作台自己的根上（`data-mahua-mode`），CSS 只认最近的这段属性。
 */
function readMode(): HostMode {
	const value = document.documentElement.dataset.mode;
	if (value === "dark" || value === "light") return value;
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useHostMode(): HostMode {
	const [mode, setMode] = useState<HostMode>(readMode);

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const sync = () => setMode(readMode());

		sync();
		const observer = new MutationObserver(sync);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
		media.addEventListener("change", sync);

		return () => {
			observer.disconnect();
			media.removeEventListener("change", sync);
		};
	}, []);

	return mode;
}
