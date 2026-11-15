/**
 * 输入框里那行会动的提示（很快的那种）。
 *
 * 为什么值得做：这一格在绝大多数时间里是空的，而它最该说的是"你可以直接说目标"。
 * 静态占位符只在那一次显影；逐字敲出来的短句会让人本能地读它一遍——这是终端里的常见手法，
 * 也是本插件界面唯一的"活"的东西。
 *
 * 三条约束：
 *  - **快**：默认 18ms 一个字、停留 1.1s、回删 9ms；整句 12 字约 0.2s 敲完，
 *    慢一点就变成等待，等待在输入框里是噪声；
 *  - **不打断输入**：一旦有内容（用户开始写）就停止并隐藏，不闪烁、不移动光标；
 *  - **可关**：`prefers-reduced-motion: reduce` 时只显示第一句静态文本（无障碍底线）。
 */

import { useEffect, useMemo, useRef, useState } from "react";

export interface TypewriterOptions {
	/** 逐字输入的速度（毫秒/字）。 */
	typeMs?: number;
	/** 整句敲完停留多久再回删。 */
	holdMs?: number;
	/** 回删速度。 */
	eraseMs?: number;
}

/** 读系统的动效偏好；SSR/测试环境没有 matchMedia 时按"允许"处理。 */
function prefersReducedMotion(): boolean {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 逐字显示 `lines`，一句一句循环。
 *
 * 返回当前该显示的字符串（可能为空串：回删到底的那一刻）。
 * `paused` 为 true（比如已经有输入、或者输入框只读）时返回 undefined，
 * 让调用方决定不显示占位符——这里不替它做"显示什么"的决定。
 */
export function useTypewriter(
	lines: readonly string[],
	options: TypewriterOptions & { paused?: boolean } = {},
): string | undefined {
	const { typeMs = 18, holdMs = 1100, eraseMs = 9, paused = false } = options;
	const reduced = useMemo(prefersReducedMotion, []);
	const [text, setText] = useState("");
	const state = useRef({ line: 0, char: 0, phase: "typing" as "typing" | "holding" | "erasing" });

	useEffect(() => {
		if (paused || lines.length === 0) return;
		if (reduced) {
			setText(lines[0] ?? "");
			return;
		}
		let timer: ReturnType<typeof setTimeout>;
		const tick = (): void => {
			const current = state.current;
			const line = lines[current.line % lines.length] ?? "";
			if (current.phase === "typing") {
				current.char += 1;
				setText(line.slice(0, current.char));
				if (current.char >= line.length) {
					current.phase = "holding";
					timer = setTimeout(tick, holdMs);
					return;
				}
				timer = setTimeout(tick, typeMs);
				return;
			}
			if (current.phase === "holding") {
				current.phase = "erasing";
				timer = setTimeout(tick, eraseMs);
				return;
			}
			current.char -= 1;
			setText(line.slice(0, Math.max(0, current.char)));
			if (current.char <= 0) {
				current.phase = "typing";
				current.line += 1;
				timer = setTimeout(tick, typeMs * 4);
				return;
			}
			timer = setTimeout(tick, eraseMs);
		};
		timer = setTimeout(tick, typeMs);
		return () => clearTimeout(timer);
	}, [eraseMs, holdMs, lines, paused, reduced, typeMs]);

	if (paused) return undefined;
	// 回删到底时不显示：空占位符比一个半截词安静。
	return text.length > 0 ? text : undefined;
}

/** 占位符候选：两屏各一组，都是"直接说目标"的范例，不是指令说明。 */
export const COMPOSER_HINTS = {
	launch: ["测 staging.example.com 的登录", "看看 /api/orders 有没有越权", "10.0.0.5 全端口扫一遍"],
	scan: ["继续上一轮", "换成只打 443", "把这个接口的越权复现出来"],
} as const;
