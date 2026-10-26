import { useTranslation } from "@astravia-org/plugin-sdk";
import { cn } from "@astravia-org/ui";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type JSX } from "react";
import type { CanvasController } from "../../../runtime.ts";
import { CanvasDiagnosticsPanel } from "./canvas-diagnostics-panel.tsx";
import { CanvasModelsPanel } from "./canvas-models-panel.tsx";
import { CanvasOverviewPanel } from "./canvas-overview-panel.tsx";
import { CanvasStatusBar } from "./canvas-status-bar.tsx";
import { CanvasToolsPanel } from "./canvas-tools-panel.tsx";

// Tab 顺序即使用顺序：先看能不能用，再配模型，再发现工具，出问题才看诊断。
const TABS = ["overview", "models", "tools", "diagnostics"] as const;
type Tab = (typeof TABS)[number];

/**
 * 画布工作区视图。
 *
 * 这里只做三件事：订阅控制器状态、钉住顶部状态条、切 Tab。
 * 具体内容交给各自的 panel，避免重新长成一个什么都管的单文件。
 */
export function CanvasView({ controller }: { controller: CanvasController }): JSX.Element {
  const { t } = useTranslation();
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = controller.subscribe(() => onChange());
      return () => subscription.dispose();
    },
    [controller],
  );
  const getSnapshot = useCallback(() => controller.getState(), [controller]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const [tab, setTab] = useState<Tab>("overview");
  // 维护动作的结果只活在这一屏：一次性反馈，不该进全局状态。
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 补一次拉取，但不与渲染同相：同步触发的状态广播会让宿主在同一轮里再次入口。
  useEffect(() => {
    const timer = setTimeout(() => {
      void controller.ensureLoaded();
    }, 0);
    return () => clearTimeout(timer);
  }, [controller]);

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const showHint = useCallback((message: string) => {
    setHint(message);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 4000);
  }, []);

  const busy = state.busy;

  return (
    <div className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-background">
      <div className="drag-region h-6 shrink-0" />

      <CanvasStatusBar
        state={state}
        busy={busy}
        onStart={() => void controller.ensureRunning()}
        onStop={() => void controller.stop()}
        onRestart={() => void controller.restart()}
        onOpen={() => void controller.openInBrowser()}
      />

      <nav className="mx-auto flex w-full max-w-3xl gap-1 border-b border-border/60 px-6">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "-mb-px border-b-2 px-2 py-2 text-[12px] transition-colors",
              tab === item
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tab.${item}`)}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-4 pb-10">
          {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}

          {tab === "overview" ? (
            <CanvasOverviewPanel
              state={state}
              busy={busy}
              controller={controller}
              onResidueCleared={showHint}
              onGoModels={() => setTab("models")}
            />
          ) : null}
          {tab === "models" ? <CanvasModelsPanel state={state} controller={controller} /> : null}
          {tab === "tools" ? <CanvasToolsPanel state={state} controller={controller} /> : null}
          {tab === "diagnostics" ? (
            <CanvasDiagnosticsPanel state={state} busy={busy} controller={controller} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
