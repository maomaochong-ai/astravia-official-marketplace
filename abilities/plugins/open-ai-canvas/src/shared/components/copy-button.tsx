import { Button, cn } from "@astravia-org/ui";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { writeClipboard } from "../../features/canvas-workspace/services/clipboard.ts";

export type CopyState = "idle" | "copied" | "failed";

/**
 * 复制按钮：把一段固定文本送进剪贴板，并自己维护「已复制 / 失败」这两秒的状态。
 *
 * 为什么每个按钮自己管状态：以前是在父组件里用一个 hint 字符串按动作复用，
 * 页面上有六个复制入口时就分不清是哪一句成功了。这里把提示贴在按钮上，
 * 位置本身就是答案。
 */
export function CopyButton({
  text,
  label,
  copiedLabel,
  failedLabel,
  disabled,
  className,
}: {
  /** 可以是函数：诊断信息这类内容每次点击都要重新读一次当前状态。 */
  text: string | (() => string);
  label: string;
  copiedLabel: string;
  failedLabel: string;
  disabled?: boolean;
  className?: string;
}): JSX.Element {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = async (): Promise<void> => {
    const payload = typeof text === "function" ? text() : text;
    const ok = await writeClipboard(payload);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={() => void handleClick()}
      className={cn("h-7 px-2 text-[12px]", className)}
    >
      {state === "copied" ? copiedLabel : state === "failed" ? failedLabel : label}
    </Button>
  );
}
