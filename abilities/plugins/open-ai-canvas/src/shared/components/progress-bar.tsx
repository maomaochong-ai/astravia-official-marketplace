import { cn } from "@astravia-org/ui";
import type { JSX } from "react";

/**
 * 准备期进度条。
 *
 * 两种形态是刻意的：`percent <= 0` 时画一条来回走的脉冲条，因为「正在解析来源」
 * 这种阶段确实没有可用于百分比的分母；把它画成 0% 会让人以为卡死了。
 */
export function ProgressBar({
  percent,
  tone = "active",
  className,
}: {
  percent: number;
  tone?: "active" | "danger";
  className?: string;
}): JSX.Element {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const known = clamped > 0;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? clamped : undefined}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "danger" ? "bg-destructive" : "bg-primary",
          known ? "" : "animate-pulse",
        )}
        style={{ width: known ? `${clamped}%` : "35%" }}
      />
    </div>
  );
}
