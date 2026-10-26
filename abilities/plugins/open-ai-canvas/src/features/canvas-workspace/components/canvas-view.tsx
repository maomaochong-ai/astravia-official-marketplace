import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button, cn } from "@astravia-org/ui";
import { useCallback, useEffect, useState, useSyncExternalStore, type JSX } from "react";
import type { CanvasController, CanvasState } from "../../../runtime";

const PHASE_TONE: Record<CanvasState["phase"], string> = {
  idle: "text-muted-foreground",
  installing: "text-primary",
  starting: "text-primary",
  running: "text-emerald-500",
  stopping: "text-muted-foreground",
  error: "text-destructive",
};

/**
 * 写剪贴板。宿主渲染进程不一定有 navigator.clipboard（非安全上下文 / 旧内核），
 * 所以保留一个 textarea + execCommand 的兜底——拿不到也没关系，调用方只报成败。
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到下面的兜底
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CanvasView({ controller }: { controller: CanvasController }): JSX.Element {
  const { t } = useTranslation();
  // useSyncExternalStore 要求订阅函数稳定，否则每次渲染都会重订阅。
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = controller.subscribe(() => onChange());
      return () => subscription.dispose();
    },
    [controller],
  );
  const getSnapshot = useCallback(() => controller.getState(), [controller]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // 补一次拉取，但不与渲染同相：同步触发的状态广播会让宿主在同一轮里再次入口。
  useEffect(() => {
    const timer = setTimeout(() => {
      void controller.ensureLoaded();
    }, 0);
    return () => clearTimeout(timer);
  }, [controller]);

  const busy = state.busy;
  // 维护动作的结果只活在这一屏：成功与否都是一次性反馈，不需要进全局状态。
  const [hint, setHint] = useState<string | null>(null);
  const running = state.phase === "running";

  // 报障时用户能说的话只有“打不开”。把机器相关的实情拼成一段可粘贴的文本，
  // 比让人去翻日志文件现实。只写状态字段，不带会话 token。
  const copyDiagnostics = useCallback(async () => {
    const text = [
      `phase: ${state.phase}`,
      `message: ${state.messageKey ?? ""}`,
      `detail: ${state.detail ?? ""}`,
      `origin: ${state.origin ?? ""}`,
      `upstream: ${state.canvasVersion ?? ""}`,
      `loginRequired: ${String(state.loginRequired)}`,
      `bridge: online=${String(state.bridge.executorOnline)} models=${state.bridge.models}`,
      "log:",
      state.log ?? "(empty)",
    ].join("\n");
    const ok = await writeClipboard(text);
    setHint(t(ok ? "action.diagnosticsCopied" : "action.diagnosticsFailed"));
  }, [state, t]);

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
          {/* 具体到这台机器的原因或进度：平台名、已发布平台、下载百分比、后端原文。 */}
          {state.detail ? (
            <p className="mt-2 break-words font-mono text-[12px] leading-relaxed text-muted-foreground">
              {state.detail}
            </p>
          ) : null}
          <p className="mt-2 text-[13px] text-muted-foreground">
            {t("view.description")}
          </p>
          {/* ADR-0010 / ADR-0001 兼容节：地址与上游版本要看得见——
              「用哪个地址打开的」「这画布是哪一版」不该靠猜。 */}
          <dl className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            {state.origin ? (
              <div className="flex gap-2">
                <dt className="shrink-0">{t("meta.address")}</dt>
                <dd className="break-all font-mono">{state.origin}</dd>
              </div>
            ) : null}
            {state.canvasVersion ? (
              <div className="flex gap-2">
                <dt className="shrink-0">{t("meta.upstream")}</dt>
                <dd className="font-mono">{state.canvasVersion}</dd>
              </div>
            ) : null}
          </dl>
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

        {/* 维护（ADR-0011）：下载失败后 data/runtime 里会留上百 MB 的 .partN。
            没有入口就只能靠用户自己摸文件系统——“重试”到底接不接着旧字节也看不出来。 */}
        <section className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              const result = await controller.clearPayloadResidue();
              if (!result) {
                setHint(t("action.residueFailed"));
                return;
              }
              setHint(
                result.removed > 0
                  ? t("action.residueCleared", {
                      count: result.removed,
                      mb: (result.freedBytes / 1048576).toFixed(1),
                    })
                  : t("action.residueNone"),
              );
            }}
          >
            {t("action.clearResidue")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void copyDiagnostics()}>
            {t("action.copyDiagnostics")}
          </Button>
          {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
        </section>

        {/* ADR-0002 决策 4：会话缺失/过期时，401 只会出现在工具调用里；
            在这里给一次明确的下一步，而不是让用户把 401 当故障。 */}
        {running && state.loginRequired ? (
          <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <h2 className="text-[14px] font-medium">{t("login.title")}</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {t("login.description")}
            </p>
            <Button
              className="mt-3"
              size="sm"
              onClick={() => void controller.openInBrowser()}
              disabled={busy}
            >
              {t("login.action")}
            </Button>
          </section>
        ) : null}

        {/* 模型桥（ADR-0006）：两个方向都是显式动作，不做启动副作用。 */}
        {running && (
          <section className="rounded-xl border border-border/70 bg-card/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-medium">{t("bridge.title")}</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px]",
                  state.bridge.executorOnline
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {state.bridge.executorOnline ? t("bridge.online") : t("bridge.offline")}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("bridge.modelCount", { count: state.bridge.models })}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {t("bridge.description")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void controller.connectHostModelsToCanvas()}
                disabled={state.bridge.busy}
              >
                {t("bridge.connectHost")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void controller.publishCanvasChannelsToHost()}
                disabled={state.bridge.busy}
              >
                {t("bridge.publishCanvas")}
              </Button>
            </div>
            {state.bridge.noticeKey ? (
              <p className="mt-2 text-[12px] text-emerald-600">{t(state.bridge.noticeKey)}</p>
            ) : null}
            {state.bridge.detail ? (
              <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground">
                {state.bridge.detail}
              </p>
            ) : null}
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {t("bridge.caveat")}
            </p>
          </section>
        )}

        {/* 最近一次工作流（ADR-0007 决策 5）：agent 建完图，用户要能在这里确认发生了什么。 */}
        {running && state.workflow ? (
          <section className="rounded-xl border border-border/70 bg-card/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-medium">{t("workflow.title")}</h2>
              <span className="text-[11px] text-muted-foreground">
                {t("workflow.summary", {
                  nodes: state.workflow.nodes,
                  edges: state.workflow.edges,
                  revision: state.workflow.revision,
                })}
              </span>
              {state.workflow.idempotent ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {t("workflow.replay")}
                </span>
              ) : null}
              {state.workflow.generationCount > 0 ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">
                  {t("workflow.generations", { count: state.workflow.generationCount })}
                </span>
              ) : null}
            </div>
            <p className="mt-2 break-words font-mono text-[11px] text-muted-foreground">
              {state.workflow.canvasId}
            </p>
          </section>
        ) : null}

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

        {/* ADR-0001 决策 5：宿主本来就把进程输出交在手上，折叠起来即可，
            不必让用户去翻日志文件。 */}
        {state.log ? (
          <section className="rounded-xl border border-border/70 bg-card/40 p-4">
            <h2 className="text-[14px] font-medium">{t("log.title")}</h2>
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] text-muted-foreground">
                {t("log.expand")}
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
                {state.log}
              </pre>
            </details>
          </section>
        ) : null}
      </div>
    </div>
  );
}
