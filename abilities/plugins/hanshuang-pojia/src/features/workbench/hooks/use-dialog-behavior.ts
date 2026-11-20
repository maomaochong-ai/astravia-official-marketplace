import { useEffect, useRef } from "react";

/**
 * 弹窗的键盘与焦点行为。
 *
 * 三个提示词弹窗（编辑 / 预览 / 备份）此前只有「点遮罩关闭」一条路：键盘用户按 Esc 没反应，
 * 读屏也拿不到 `dialog` 语义。而文档预览与活动载荷弹窗已经各自手写了一版 —— 两套规范。
 * 抽成一个 hook 之后，加一处等于全部生效。
 *
 * 用法：在弹窗组件**顶部无条件调用**（不能放在 `if (!open) return null` 之后），
 * 把返回的 ref 挂到弹窗容器上，并给容器 `role="dialog" aria-modal="true"`。
 */
export function useDialogBehavior(open: boolean, onClose: () => void) {
	const ref = useRef<HTMLDivElement | null>(null);
	const restoreTo = useRef<HTMLElement | null>(null);

	// onClose 常常是内联箭头函数：直接进依赖数组会让 effect 每次渲染重跑，
	// 焦点被反复抢回弹窗。所以只存最新引用。
	const latest = useRef(onClose);
	useEffect(() => {
		latest.current = onClose;
	}, [onClose]);

	useEffect(() => {
		if (!open) return;
		restoreTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		ref.current?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			// 弹窗里的 Esc 不该同时关掉外层的东西。
			event.stopPropagation();
			latest.current();
		};
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("keydown", onKey);
			restoreTo.current?.focus();
		};
	}, [open]);

	return ref;
}
