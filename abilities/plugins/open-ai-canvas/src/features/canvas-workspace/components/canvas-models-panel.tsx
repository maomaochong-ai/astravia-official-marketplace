import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button, cn } from "@astravia-org/ui";
import { useEffect, type JSX } from "react";
import type { CanvasController, CanvasState } from "../../../runtime.ts";
import { SectionCard } from "../../../shared/components/section-card.tsx";
import { modesOf, type CanvasCatalogEntry } from "../canvas-media-provider.ts";

/**
 * 模型桥（ADR-0006 / ADR-0013）：两个方向都是显式动作，不做启动副作用。
 *
 * 反方向不再是「导出画布渠道」——那条路径抄的是用户自己填的密钥，而画布的管理端点在
 * 普通会话下恒不下发密钥（`publicChannel` 的 apiKey 只在 admin 视图填充）。现在换成媒体
 * Provider：宿主拿模型目录，画布拿密钥。所以这一屏的重点是把目录**列出来**——用户要能看见
 * 自己在画布里配的模型确实被读到了，才谈得上「接进宿主」。
 */
export function CanvasModelsPanel({
  state,
  controller,
}: {
  state: CanvasState;
  controller: CanvasController;
}): JSX.Element {
  const { t } = useTranslation();
  const online = state.bridge.executorOnline;
  const busy = state.bridge.busy;
  const running = state.phase === "running";
  const counts = state.bridge.counts;
  const catalog = state.bridge.catalog;
  const media = (counts?.image ?? 0) + (counts?.video ?? 0);
  const registered = state.bridge.mediaRegistered;
  const projection = state.bridge.projection;

  // 目录是只读的，进这一屏就自己读一次：用户不该为了「看一眼有哪些模型」先点刷新。
  useEffect(() => {
    if (!running || busy || counts) return;
    void controller.refreshCanvasCatalog();
  }, [controller, running, busy, counts]);

  const bridged = catalog ? catalog.filter((model) => modesOf(model).length > 0) : [];
  const unbridged = catalog ? catalog.filter((model) => model.kind !== "text" && modesOf(model).length === 0) : [];

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title={t("bridge.title")}
        badge={
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px]",
              online ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
            )}
          >
            {online ? t("bridge.online") : t("bridge.offline")}
          </span>
        }
      >
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t("bridge.description")}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("bridge.modelCount", { count: state.bridge.models })}
        </p>
        {!running ? <p className="mt-2 text-[11px] text-muted-foreground">{t("models.needsRunning")}</p> : null}
        {state.bridge.noticeKey ? (
          <p className="mt-2 text-[12px] text-emerald-600">
            {t(state.bridge.noticeKey, { count: registered ?? media })}
          </p>
        ) : null}
        {state.bridge.detail ? (
          <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground">{state.bridge.detail}</p>
        ) : null}
      </SectionCard>

      <SectionCard
        title={t("bridge.catalogTitle")}
        description={t("models.direction2Body")}
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !running}
            onClick={() => void controller.refreshCanvasCatalog()}
          >
            {t("bridge.refreshCatalog")}
          </Button>
        }
      >
        {counts ? (
          <p className="mt-1 text-[12px] text-muted-foreground">
            {t("bridge.catalogCounts", { image: counts.image, video: counts.video, text: counts.text })}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {running ? t("bridge.catalogLoading") : t("bridge.catalogEmpty")}
          </p>
        )}

        {catalog && catalog.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {catalog.map((model) => (
              <CatalogRow key={model.id} model={model} />
            ))}
          </ul>
        ) : null}

        {unbridged.length > 0 ? (
          <p className="mt-3 text-[11px] leading-relaxed text-amber-600">
            {t("bridge.catalogUnsupported", { count: unbridged.length })}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={busy || !running || media === 0}
            onClick={() => void controller.connectCanvasMediaToHost()}
          >
            {registered === undefined ? t("bridge.connectMedia") : t("bridge.reconnectMedia")}
          </Button>
          {registered !== undefined ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void controller.disconnectCanvasMediaFromHost()}
            >
              {t("bridge.disconnectMedia")}
            </Button>
          ) : null}
          <span className="text-[11px] text-muted-foreground">
            {registered === undefined
              ? t("bridge.mediaIdle")
              : t("bridge.mediaRegisteredModels", { count: registered })}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t("bridge.mediaScope")}</p>
      </SectionCard>

      <SectionCard
        title={t("models.direction1Title")}
        description={t("models.direction1Body")}
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !running}
            onClick={() => void controller.connectHostModelsToCanvas()}
          >
            {t("bridge.connectHost")}
          </Button>
        }
      >
        {/* 报的是画布目录确认的条数，不是插件发出去的条数（ADR-0015 决策 4）。 */}
        {projection ? (
          <p
            className={cn(
              "mt-1 text-[12px]",
              projection.usable > 0 ? "text-emerald-600" : "text-amber-600",
            )}
          >
            {t("bridge.projected", {
              usable: projection.usable,
              requested: projection.requested,
              blocked: projection.blocked,
              missing: projection.missing,
            })}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">{t("bridge.projectionIdle")}</p>
        )}
        {projection && projection.removed > 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("bridge.projectionRemoved", { count: projection.removed })}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t("bridge.projectionScope")}</p>
      </SectionCard>

      <SectionCard>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("bridge.caveat")}</p>
      </SectionCard>
    </div>
  );
}

/**
 * 一行一个模型：名字 + 能力徽标 + 能跑的模式。
 *
 * 不显示密钥、渠道或价格——宿主只关心「叫什么、能生成什么」。不可用的模型仍然列出来并
 * 标灰，因为「画布里明明有，宿主里没有」比「两个列表都没有」更难排查。
 */
function CatalogRow({ model }: { model: CanvasCatalogEntry }): JSX.Element {
  const { t } = useTranslation();
  const modes = modesOf(model);
  const bridged = modes.length > 0;
  const video = model.kind === "video";

  return (
    <li className={cn("flex items-baseline gap-2 text-[12px]", !model.available && "opacity-60")}>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
          video ? "bg-sky-500/10 text-sky-600" : "bg-violet-500/10 text-violet-600",
        )}
      >
        {t(`bridge.kind.${model.kind}`)}
      </span>
      <span className="min-w-0 flex-1 truncate" title={model.description || model.name}>
        {model.name}
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {bridged ? modes.join(" · ") : model.kind === "text" ? null : t("bridge.rowTextOnly")}
      </span>
      {!model.available ? (
        <span className="shrink-0 text-[10px] text-amber-600">{t("bridge.rowUnavailable")}</span>
      ) : null}
    </li>
  );
}
