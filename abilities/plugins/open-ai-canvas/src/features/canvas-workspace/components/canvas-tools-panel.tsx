import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button } from "@astravia-org/ui";
import type { JSX } from "react";
import { useEffect } from "react";
import type { CanvasController, CanvasState, ToolSummary } from "../../../runtime.ts";
import { CopyButton } from "../../../shared/components/copy-button.tsx";
import { SectionCard } from "../../../shared/components/section-card.tsx";

// 展示顺序 = 使用顺序：先找到项目，再摆节点，接起来，跑生成，最后才是批量与工作区。
const GROUP_ORDER = ["projects", "nodes", "connections", "generation", "batch", "workspace", "other"];

/** 拼一段可以直接粘给智能体的说明：它比让用户自己念工具名有用得多。 */
function briefText(tools: ToolSummary[], header: string): string {
  const lines = [header, ""];
  for (const group of GROUP_ORDER) {
    const items = tools.filter((tool) => tool.group === group);
    if (items.length === 0) continue;
    lines.push(`## ${group}`);
    for (const item of items) lines.push(`- ${item.name}: ${item.description}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

/**
 * 工具页：把插件相对上游多出来的那 20 个 MCP 工具摆到界面上。
 *
 * 为什么值得占一个 Tab：这些工具是插件唯一真正的增量能力，改版前用户只会在
 * agent 偶尔调对一次时才知道画布能被操作。这里给出清单和一句可直接粘贴的说明。
 */
export function CanvasToolsPanel({
  state,
  controller,
}: {
  state: CanvasState;
  controller: CanvasController;
}): JSX.Element {
  const { t } = useTranslation();
  const tools = state.tools;
  const failed = state.toolsError === "unreachable";

  useEffect(() => {
    void controller.loadToolCatalog();
  }, [controller, state.phase]);

  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: (tools ?? []).filter((tool) => tool.group === group),
  })).filter((entry) => entry.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title={t("tools.title")}
        description={t("tools.description")}
        badge={
          tools && tools.length > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {t("tools.count", { count: tools.length })}
            </span>
          ) : null
        }
        actions={
          <>
            {tools && tools.length > 0 ? (
              <CopyButton
                text={() => briefText(tools, t("tools.briefHeader"))}
                label={t("tools.copyBrief")}
                copiedLabel={t("action.diagnosticsCopied")}
                failedLabel={t("action.diagnosticsFailed")}
              />
            ) : null}
            {!tools && failed ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // toolsError 不是 tools：清掉才能让控制器再拉一次。
                  void controller.loadToolCatalog();
                }}
              >
                {t("tools.retry")}
              </Button>
            ) : null}
          </>
        }
      />

      {!tools && !failed ? (
        <p className="text-[12px] text-muted-foreground">{t("tools.loading")}</p>
      ) : null}
      {failed ? <p className="text-[12px] text-muted-foreground">{t("tools.unreachable")}</p> : null}

      {groups.map((entry) => (
        <SectionCard key={entry.group} title={t(`tools.group.${entry.group}`)}>
          <ul className="mt-2 divide-y divide-border/60">
            {entry.items.map((tool) => (
              <li key={tool.name} className="py-2">
                <code className="font-mono text-[12px] text-foreground">{tool.name}</code>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{tool.description}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}

      {tools && tools.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("tools.usageHint")}</p>
      ) : null}
    </div>
  );
}
