import { cn } from "@astravia-org/ui";
import type { JSX, ReactNode } from "react";

/**
 * 卡片内部的次级容器。
 *
 * 为什么需要它：区块之间一旦都用边框分隔，页面很快就变成一张表格。这里给的是
 * 「圆角套圆角」的层次——外层 `SectionCard` 用底色分层，内层用更深一档的底色和
 * 更小的圆角包住一组行，读起来有嵌套关系，却不需要多画一条线。
 */
export function InsetPanel({
  tone = "sunken",
  className,
  children,
}: {
  /** sunken 用于成组的行/日志，accent 用于需要一点强调的块。 */
  tone?: "sunken" | "accent";
  className?: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-2xl p-3",
        tone === "accent" ? "bg-primary/[0.06]" : "bg-background/55",
        className,
      )}
    >
      {children}
    </div>
  );
}
