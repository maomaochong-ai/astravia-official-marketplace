import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button, cn } from "@astravia-org/ui";
import { useEffect, useState, type JSX } from "react";
import type { CanvasController, CanvasState } from "../../../runtime";

const PHASE_TONE: Record<CanvasState["phase"], string> = {
  idle: "text-muted-foreground",
  installing: "text-primary",
  starting: "text-primary",
  running: "text-emerald-500",
  stopping: "text-muted-foreground",
  error: "text-destructive",
};

export function CanvasView({ controller }: { controller: CanvasController }): JSX.Element {
  const { t } = useTranslation();
  const [state, setState] = useState<CanvasState>(controller.getState());

  useEffect(() => {
    const subscription = controller.subscribe(setState);
    return () => subscription.dispose();
  }, [controller]);

  const busy = state.busy;
  const running = state.phase === "running";

  return (
    <div className="relative flex h-full w-full flex-1 flex-col overflow-y-auto bg-background">
      <div className="drag-region h-6 shrink-0" />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 pb-10">
        {/* 状态卡 */}
        <section className="rounded-xl border border-border/70 bg-card/60 p-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "icon-[solar--palette-2-linear] h-5 w-5 shrink-0",
                PHASE_TONE[state.phase],
              )}
            />
            <h1 className={cn("text-[16px] font-semibold", PHASE_TONE[state.phase])}>
              {t(`status.${state.phase}`)}
            </h1>
            {state.messageKey ? (
              <span className="truncate text-[12px] text-destructive/80">{t(state.messageKey)}</span>
            ) : null}
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {t("view.description")}
          </p>
        </section>

        {/* 操作按钮 */}
        <section className="flex flex-wrap gap-3">
          {!running ? (
            <Button onClick={() => void controller.ensureRunning()} disabled={busy}>
              {t("action.start")}
            </Button>
          ) : (
            <>
              <Button onClick={() => void controller.openInBrowser()} disabled={busy}>
                {t("action.openBrowser")}
              </Button>
              <Button variant="outline" onClick={() => void controller.stop()} disabled={busy}>
                {t("action.stop")}
              </Button>
            </>
          )}
        </section>

        {/* 使用提示 */}
        {running && (
          <section className="rounded-xl border border-border/70 bg-card/40 p-4">
            <h2 className="text-[14px] font-medium">{t("tips.title")}</h2>
            <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
              <li>• {t("tips.login")}</li>
              <li>• {t("tips.mcp")}</li>
              <li>• {t("tips.dataDir")}</li>
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
