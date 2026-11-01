import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button } from "@astravia-org/ui";
import type { JSX } from "react";
import type { CanvasController, CanvasState } from "../../../runtime.ts";
import { ProgressBar } from "../../../shared/components/progress-bar.tsx";
import { InsetPanel } from "../../../shared/components/inset-panel.tsx";
import { SectionCard } from "../../../shared/components/section-card.tsx";
import { StatusPill } from "../../../shared/components/status-pill.tsx";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatEta(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/** 安装时间只用来定位「这是哪一版」，不需要秒级精度。 */
function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
/**
 * 概览：这台机器现在能不能用、卡在哪、下一步该按什么。
 *
 * 为什么要有「下一步」而不是只放按钮：改版前的按钮是固定的「启动 / 打开 / 停止」，
 * 用户得先自己判断当前处于哪个阶段，才知道该按哪一个。这里把判断写进页面：
 * 每个状态下只推一条主要动作，其余收进次要按钮。
 */
/** 主推动作只有一个；其余带 outline，视觉上是次要入口。 */
interface NextAction {
  label: string;
  run: () => void;
  outline?: boolean;
}

export function CanvasOverviewPanel({
  state,
  busy,
  controller,
  onResidueCleared,
  onGoModels,
}: {
  state: CanvasState;
  busy: boolean;
  controller: CanvasController;
  /** 清理残留的结果文案由容器统一显示，避免两个组件各说一套。 */
  onResidueCleared: (message: string) => void;
  /** 运行中时换 Tab 的唯一入口，避免面板自己复制 Tab 状态。 */
  onGoModels: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const running = state.phase === "running";
  const update = state.update;
  const progress = state.progress;
  const eta = progress ? formatEta(progress.etaSeconds) : undefined;
  /** 开关名的翻译：缺条目时退回原始键——界面宁可显示 `fooEnabled`，也不留一行空白。 */
  const featureLabel = (key: string): string => {
    const translated = t(`features.name.${key}`);
    return translated === `features.name.${key}` ? key : translated;
  };
  const featureItems = Object.entries(state.features?.items ?? {});
  const featureOff = featureItems.filter(([, on]) => !on).map(([key]) => key);
  /** 侧边栏缺的那两项就是这两个开关；单独提一句，否则用户会先去怀疑版本。 */
  const workbenchOff =
    state.features?.items.imageWorkbenchEnabled === false || state.features?.items.videoWorkbenchEnabled === false;

  const nextStep: { title: string; body: string; actions: NextAction[] } = (() => {
    if (state.phase === "error") {
      return {
        title: t("next.error.title"),
        body: state.messageKey ? t(state.messageKey) : t("next.error.body"),
        actions: [{ label: t("action.restart"), run: () => void controller.restart() }],
      };
    }
    if (state.phase === "installing" || state.phase === "starting") {
      return {
        title: t("next.preparing.title"),
        body: t("next.preparing.body"),
        actions: [],
      };
    }
    if (state.phase === "running" && state.loginRequired) {
      return {
        title: t("next.login.title"),
        body: t("next.login.body"),
        actions: [{ label: t("login.action"), run: () => void controller.openInBrowser() }],
      };
    }
    if (running) {
      return {
        title: t("next.ready.title"),
        body: t("next.ready.body"),
        // 跑起来之后的下一步不再只有一个「打开画布」——配好模型的人想接进宿主，
        // 这一步不该让他自己去翻 Tab。
        actions: [
          { label: t("action.openBrowser"), run: () => void controller.openInBrowser() },
          { label: t("action.bridgeModels"), run: onGoModels, outline: true },
        ],
      };
    }
    return {
      title: t("next.idle.title"),
      body: t("next.idle.body"),
      actions: [{ label: t("action.start"), run: () => void controller.ensureRunning() }],
    };
  })();

  return (
    <div className="flex flex-col gap-4">
      {progress ? (
        <SectionCard
          title={t("progress.title")}
          badge={
            <StatusPill>
              {progress.percent > 0 ? `${Math.round(progress.percent)}%` : t("progress.indeterminate")}
            </StatusPill>
          }
        >
          <InsetPanel className="mt-3">
            <ProgressBar percent={progress.percent} />
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {progress.stage ? <span>{progress.stage}</span> : null}
              {progress.totalBytes > 0 ? (
                <span>
                  {t("progress.bytes", {
                    done: formatBytes(progress.receivedBytes),
                    total: formatBytes(progress.totalBytes),
                  })}
                </span>
              ) : null}
              {progress.speed > 0 ? (
                <span>{t("progress.speed", { speed: formatBytes(progress.speed) })}</span>
              ) : null}
              {eta ? <span>{t("progress.eta", { eta })}</span> : null}
            </p>
            {progress.fileName ? (
              <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{progress.fileName}</p>
            ) : null}
          </InsetPanel>
        </SectionCard>
      ) : null}

      <SectionCard title={t("next.title")}>
        <p className="mt-2 text-[13px] font-medium">{nextStep.title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{nextStep.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {nextStep.actions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.outline ? "outline" : undefined}
              disabled={busy}
              onClick={action.run}
            >
              {action.label}
            </Button>
          ))}
          {state.phase === "error" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={async () => {
                const result = await controller.clearPayloadResidue();
                if (!result) {
                  onResidueCleared(t("action.residueFailed"));
                  return;
                }
                onResidueCleared(
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
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={t("update.title")}
        badge={
          update?.upgradeAvailable ? (
            <StatusPill tone="accent">
              {t("update.available", { version: update.available ?? "" })}
            </StatusPill>
          ) : null
        }
      >
        <p className="mt-2 text-[13px]">
          <span className="text-muted-foreground">{t("update.current")}: </span>
          <span className="font-mono">{update?.current ?? state.payloadVersion ?? "—"}</span>
        </p>
        {update?.upstreamAvailable ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("update.upstreamTag", { tag: update.upstreamAvailable })}
          </p>
        ) : null}
        {update?.installedAt ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("update.installedAt", { time: formatWhen(update.installedAt) })}
          </p>
        ) : null}
        {update?.noticeKey ? (
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            {t(update.noticeKey, { version: update.available ?? "" })}
          </p>
        ) : (
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t("overview.updateHint")}</p>
        )}
        {update?.detail ? (
          <p className="mt-1 break-words text-[11px] text-muted-foreground/80">{update.detail}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !running || update?.checking || update?.upgrading}
            onClick={() => void controller.checkForUpdates()}
          >
            {update?.checking ? t("update.checking") : t("update.check")}
          </Button>
          {update?.upgradeAvailable ? (
            <Button
              size="sm"
              disabled={busy || !running || update?.upgrading}
              onClick={() => void controller.upgradeRuntime()}
            >
              {update?.upgrading ? t("update.upgrading") : t("update.upgrade")}
            </Button>
          ) : null}
        </div>
        {update?.bundled ? <p className="mt-2 text-[11px] text-muted-foreground">{t("update.bundled")}</p> : null}
        {!update?.checkedAt ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{t("update.neverChecked")}</p>
        ) : null}
        {/* 载荷版本是目录键，不等于内容新旧。上游真正落地到哪一版，看这个 commit。 */}
        {state.canvasCommit ? (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
            {t("update.commit", { sha: state.canvasCommit.slice(0, 8) })}
          </p>
        ) : null}
      </SectionCard>
      {/*
       * 为什么要单独报「功能开放」：侧边栏少了几项时，人第一反应是“版本旧了”，
       * 然后去升级运行时——可这十二个开关在默认值里就是关的（图片/视频工作台），
       * 升级再多次也不会打开。把开关状态、关闭项和入口摆在版本卡旁边，误判就没那么便宜了。
       * 这里只读：写入在画布自己的管理页，插件不替用户改人家的设置。
       */}
      {running ? (
        <SectionCard
          title={t("features.title")}
          description={t("features.description")}
          badge={
            featureItems.length > 0 ? (
              <StatusPill tone={featureOff.length > 0 ? "warning" : "success"}>
                {t("features.count", {
                  enabled: featureItems.length - featureOff.length,
                  total: featureItems.length,
                })}
              </StatusPill>
            ) : null
          }
          actions={
            <Button
              size="sm"
              variant="outline"
              disabled={busy || state.featuresError === "pending"}
              onClick={() => void controller.loadFeatures(true)}
            >
              {t("features.retry")}
            </Button>
          }
        >
          {state.featuresError === "pending" ? (
            <p className="mt-3 text-[12px] text-muted-foreground">{t("features.loading")}</p>
          ) : state.featuresError === "loginRequired" ? (
            <InsetPanel className="mt-3">
              <p className="text-[12px] leading-relaxed text-muted-foreground">{t("features.loginRequired")}</p>
            </InsetPanel>
          ) : state.featuresError ? (
            <InsetPanel className="mt-3">
              <p className="text-[12px] leading-relaxed text-muted-foreground">{t("features.unavailable")}</p>
            </InsetPanel>
          ) : state.features ? (
            <>
              {featureOff.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1 text-[12px]">
                  {featureOff.map((key) => (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-xl bg-background/55 px-3 py-2"
                    >
                      <span>{featureLabel(key)}</span>
                      <StatusPill tone="warning">{t("features.off")}</StatusPill>
                    </li>
                  ))}
                </ul>
              ) : null}
              {workbenchOff ? (
                <InsetPanel tone="accent" className="mt-3">
                  <p className="text-[12px] leading-relaxed">{t("features.workbenchOff")}</p>
                </InsetPanel>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void controller.openCanvasPath(
                      state.features?.settingsPath ?? "/admin/settings/features",
                    )
                  }
                >
                  {t("features.openSettings")}
                </Button>
                <span className="text-[11px] text-muted-foreground">{t("features.settingsHint")}</span>
              </div>
              {state.features.configured ? null : (
                <p className="mt-2 text-[11px] text-muted-foreground">{t("features.defaults")}</p>
              )}
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {/* 两个方向分开列：以前只说「桥在线」，用户没法判断是宿主模型没过去，还是画布模型没回来。 */}
      {running ? (
        <SectionCard
          title={t("overview.syncTitle")}
          actions={
            <Button
              size="sm"
              variant="outline"
              disabled={busy || state.bridge.busy}
              onClick={() => void controller.resyncModels()}
            >
              {t("overview.syncResync")}
            </Button>
          }
        >
          <ul className="mt-3 flex flex-col gap-1 text-[12px]">
            <li className="flex items-center justify-between gap-3 rounded-xl bg-background/55 px-3 py-2">
              <span className="text-muted-foreground">{t("overview.syncToCanvas")}</span>
              <span className="shrink-0 font-medium">
                {state.bridge.projection
                  ? t("overview.syncUsable", {
                      usable: state.bridge.projection.usable,
                      requested: state.bridge.projection.requested,
                    })
                  : t("overview.syncPending")}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-xl bg-background/55 px-3 py-2">
              <span className="text-muted-foreground">{t("overview.syncToHost")}</span>
              <span className="shrink-0 font-medium">
                {typeof state.bridge.mediaRegistered === "number"
                  ? t("overview.syncRegistered", { count: state.bridge.mediaRegistered })
                  : t("overview.syncPending")}
              </span>
            </li>
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t("overview.syncHint")}</p>
        </SectionCard>
      ) : null}

      {!running ? (
        <SectionCard title={t("overview.checkTitle")}>
          <InsetPanel className="mt-3">
            <ol className="flex list-decimal flex-col gap-1 pl-4 text-[12px] leading-relaxed text-muted-foreground">
              <li>{t("overview.checkStart")}</li>
              <li>{t("overview.checkLogin")}</li>
              <li>{t("overview.checkModels")}</li>
              <li>{t("overview.checkAgent")}</li>
            </ol>
          </InsetPanel>
        </SectionCard>
      ) : null}

      {running && state.workflow ? (
        <SectionCard
          title={t("workflow.title")}
          badge={
            <StatusPill>
              {t("workflow.summary", {
                nodes: state.workflow.nodes,
                edges: state.workflow.edges,
                revision: state.workflow.revision,
              })}
            </StatusPill>
          }
        >
          <p className="mt-2 break-words font-mono text-[11px] text-muted-foreground">{state.workflow.canvasId}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {state.workflow.idempotent ? (
              <StatusPill>
                {t("workflow.replay")}
              </StatusPill>
            ) : null}
            {state.workflow.generationCount > 0 ? (
              <StatusPill tone="success">
                {t("workflow.generations", { count: state.workflow.generationCount })}
              </StatusPill>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={t("tips.title")}>
        <InsetPanel className="mt-3">
          <ul className="flex flex-col gap-1 text-[12px] leading-relaxed text-muted-foreground">
            <li>{t("tips.login")}</li>
            <li>{t("tips.mcp")}</li>
            <li>{t("tips.dataDir")}</li>
          </ul>
        </InsetPanel>
      </SectionCard>
    </div>
  );
}
