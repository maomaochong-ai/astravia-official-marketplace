import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button, cn } from "@astravia-org/ui";
import type { JSX } from "react";
import type { CanvasState } from "../../../runtime.ts";
import { CopyButton } from "../../../shared/components/copy-button.tsx";

const PHASE_TONE: Record<CanvasState["phase"], { dot: string; text: string }> = {
  idle: { dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  installing: { dot: "bg-primary animate-pulse", text: "text-primary" },
  starting: { dot: "bg-primary animate-pulse", text: "text-primary" },
  running: { dot: "bg-emerald-500", text: "text-emerald-600" },
  stopping: { dot: "bg-muted-foreground/50 animate-pulse", text: "text-muted-foreground" },
  error: { dot: "bg-destructive", text: "text-destructive" },
};

/**
 * 顶部常驻状态条。
 *
 * 为什么钉在顶上：改版前「在跑没有」只写在第一张卡里，往下滚到模型桥或日志就看不见了，
 * 而这个页面每个按钮的含义都依赖那个状态。状态和主操作必须一直在视野里。
 */
export function CanvasStatusBar({
  state,
  busy,
  onStart,
  onStop,
  onRestart,
  onOpen,
}: {
  state: CanvasState;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onOpen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const tone = PHASE_TONE[state.phase];
  const running = state.phase === "running";
  const working =
    state.phase === "installing" || state.phase === "starting" || state.phase === "stopping";
  // 地址优先用 shim 自述的固定 origin（ADR-0010），退回宿主端口。
  const address = state.origin ?? state.baseUrl;

  return (
    <div className="sticky top-0 z-10 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-6 py-2.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} aria-hidden />
        <span className={cn("text-[13px] font-medium", tone.text)}>{t(`status.${state.phase}`)}</span>
        {state.messageKey ? (
          <span className="truncate text-[11px] text-destructive/80">{t(state.messageKey)}</span>
        ) : null}
        {address ? (
          <code className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{address}</code>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {running ? (
            <>
              <Button size="sm" disabled={busy} onClick={onOpen}>
                {t("action.openBrowser")}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={onRestart}>
                {t("action.restart")}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={onStop}>
                {t("action.stop")}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" disabled={busy || working} onClick={onStart}>
                {working ? t(`status.${state.phase}`) : t("action.start")}
              </Button>
              {state.phase === "error" ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={onRestart}>
                  {t("action.restart")}
                </Button>
              ) : null}
            </>
          )}
          {address ? (
            <CopyButton
              text={address}
              label={t("bar.copyAddress")}
              copiedLabel={t("bar.copied")}
              failedLabel={t("bar.copyFailed")}
              className="h-7"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
