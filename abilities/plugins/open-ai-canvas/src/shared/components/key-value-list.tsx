import { cn } from "@astravia-org/ui";
import type { JSX } from "react";
import { CopyButton } from "./copy-button.tsx";

export interface KeyValueItem {
  label: string;
  /** 空值直接不渲染这一行：诊断页宁可少一行，也不要一排「—」。 */
  value?: string | null;
  /** 地址、版本号这类需要逐个字符核对的用等宽字体。 */
  mono?: boolean;
  /** 给报告用的复制文本；不给就不显示复制按钮。 */
  copy?: string;
}

/**
 * 诊断信息表：标签 / 值（可复制）。
 *
 * 报障时用户总要把这些字段一条条贴进对话里，所以每一行都能单独复制，
 * 而不是只提供一个「复制全部」。
 */
export function KeyValueList({
  items,
  copiedLabel,
  failedLabel,
  copyLabel,
  className,
}: {
  items: KeyValueItem[];
  copiedLabel: string;
  failedLabel: string;
  copyLabel: string;
  className?: string;
}): JSX.Element | null {
  const rows = items.filter((item) => item.value !== undefined && item.value !== null && item.value !== "");
  if (rows.length === 0) return null;
  return (
    <dl className={cn("mt-3 divide-y divide-border/60 text-[12px]", className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3 py-1.5">
          <dt className="w-24 shrink-0 text-muted-foreground">{row.label}</dt>
          <dd
            className={cn(
              "min-w-0 flex-1 break-all",
              row.mono ? "font-mono text-[11px]" : "",
            )}
          >
            {row.value}
          </dd>
          {row.copy ? (
            <CopyButton
              text={row.copy}
              label={copyLabel}
              copiedLabel={copiedLabel}
              failedLabel={failedLabel}
              className="h-6 shrink-0 px-1.5 text-[11px]"
            />
          ) : null}
        </div>
      ))}
    </dl>
  );
}
