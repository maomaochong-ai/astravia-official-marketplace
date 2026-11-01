import { cn } from "@astravia-org/ui";
import type { JSX, ReactNode } from "react";

/**
 * 视图里唯一的定宽内容列。
 *
 * 为什么必须有它：改版前状态条与正文各自写了一遍 `mx-auto max-w-3xl`，状态条还在
 * 外层多套了一层 `px-6`，而它的卡片内层又自己 `max-w-3xl`——两份内边距叠在一起，
 * 视口宽于 3xl 时顶部卡片左右各比正文宽出 24px。宽度约束与水平内边距只允许在同一
 * 个元素上出现一次，所以两者都从这里出，谁都不许自己再写一遍。
 */
export function ContentColumn({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}): JSX.Element {
  return <div className={cn("mx-auto w-full max-w-3xl px-6", className)}>{children}</div>;
}
