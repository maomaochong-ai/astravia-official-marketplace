import { cn } from "@astravia-org/ui";
import type { JSX, ReactNode } from "react";

/**
 * 视图里的统一卡片容器。
 *
 * 为什么抽出来：改版前每个区块都手写一遍 `rounded-xl border … p-4`，标题的字号
 * 和间距各写各的，同一个页面里出现三种卡片。这里只固定容器与标题层级，
 * 内容仍然由调用方决定。
 */
export function SectionCard({
  title,
  description,
  badge,
  actions,
  className,
  children,
}: {
  title?: string;
  description?: string;
  /** 标题右侧的状态胶囊，例如「桥在线」「20 个工具」。 */
  badge?: ReactNode;
  /** 标题行右侧的操作按钮。 */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <section className={cn("rounded-xl border border-border/70 bg-card/40 p-4", className)}>
      {title ? (
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[14px] font-medium">{title}</h2>
          {badge}
          {actions ? <div className="ml-auto flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {description ? (
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </section>
  );
}
