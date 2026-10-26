import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button } from "@astravia-org/ui";
import type { JSX } from "react";
import { useState } from "react";
import type { CanvasController, CanvasState } from "../../../runtime.ts";
import { CopyButton } from "../../../shared/components/copy-button.tsx";
import { KeyValueList } from "../../../shared/components/key-value-list.tsx";
import { SectionCard } from "../../../shared/components/section-card.tsx";

/**
 * 诊断页：这台机器上到底是什么状态，以及两个维修动作。
 *
 * 为什么值得单独一页：这些字段以前散在状态卡和日志里，用户报障时只能截图。
 * 这里每一项都能单独复制，并且提供一段「一次性粘贴」的全文。
 */
export function CanvasDiagnosticsPanel({
  state,
  busy,
  controller,
}: {
  state: CanvasState;
  busy: boolean;
  controller: CanvasController;
}): JSX.Element {
  const { t } = useTranslation();
  const [hint, setHint] = useState<string | null>(null);

  const diagnosticsText = [
    `phase: ${state.phase}`,
    `message: ${state.messageKey ?? ""}`,
    `detail: ${state.detail ?? ""}`,
    `origin: ${state.origin ?? ""}`,
    `platform: ${state.platform ?? ""}`,
    `supported: ${(state.supportedPlatforms ?? []).join(",")}`,
    `upstream: ${state.canvasVersion ?? ""}`,
    `payload: ${state.payloadVersion ?? ""}`,
    `loginRequired: ${String(state.loginRequired)}`,
    `bridge: online=${String(state.bridge.executorOnline)} models=${state.bridge.models}`,
    `tools: ${state.tools?.length ?? 0}`,
    "log:",
    state.log ?? "(empty)",
  ].join("\n");

  const items = [
    { label: t("diag.address"), value: state.origin ?? state.baseUrl, mono: true },
    { label: t("diag.platform"), value: state.platform, mono: true },
    {
      label: t("diag.platforms"),
      value: state.supportedPlatforms?.length ? state.supportedPlatforms.join(" / ") : undefined,
      mono: true,
    },
    { label: t("diag.upstream"), value: state.canvasVersion, mono: true },
    { label: t("diag.payload"), value: state.payloadVersion, mono: true },
    {
      label: t("diag.session"),
      value: t(state.loginRequired ? "diag.sessionMissing" : "diag.sessionReady"),
    },
    {
      label: t("diag.bridge"),
      value: `${state.bridge.executorOnline ? t("bridge.online") : t("bridge.offline")} · ${t("bridge.modelCount", {
        count: state.bridge.models,
      })}`,
    },
    { label: t("diag.tools"), value: state.tools ? String(state.tools.length) : undefined },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title={t("diag.title")}
        description={t("diag.description")}
        actions={
          <CopyButton
            text={() => diagnosticsText}
            label={t("action.copyDiagnostics")}
            copiedLabel={t("action.diagnosticsCopied")}
            failedLabel={t("action.diagnosticsFailed")}
          />
        }
      >
        <KeyValueList
          items={items}
          copyLabel={t("diag.copyValue")}
          copiedLabel={t("bar.copied")}
          failedLabel={t("bar.copyFailed")}
        />
      </SectionCard>

      <SectionCard title={t("diag.actionsTitle")} description={t("diag.actionsDescription")}>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void controller.restart()}>
            {t("action.restart")}
          </Button>
          <Button
            size="sm"
            variant="outline"
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
          {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
        </div>
      </SectionCard>

      {state.log ? (
        <SectionCard title={t("log.title")}>
          <details className="mt-2">
            <summary className="cursor-pointer text-[12px] text-muted-foreground">{t("log.expand")}</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
              {state.log}
            </pre>
          </details>
        </SectionCard>
      ) : null}
    </div>
  );
}
