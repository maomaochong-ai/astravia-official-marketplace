import { cn } from "@astravia-org/ui";
import type { JSX, ReactNode } from "react";

export type PillTone = "neutral" | "accent" | "success" | "warning" | "info" | "violet";

const TONE: Record<PillTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600",
  warning: "bg-amber-500/10 text-amber-600",
  info: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
};

/**
 * 标题旁的状态胶囊。
 *
 * 抽出来的原因很实际：改版前同一个 `rounded-full bg-muted px-2 py-0.5 text-[11px]`
 * 在四个面板里各抄了一遍，颜色语义各写各的（同一种「在线」在两页里深浅不同）。
 * 这里只固定形状与色板，文案仍归调用方。
 */
export function StatusPill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] leading-4",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
