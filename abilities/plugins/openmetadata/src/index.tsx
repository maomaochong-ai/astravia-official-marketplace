/**
 * OpenMetadata 插件装配入口 — activate + 注册 Activity Tab / Workspace View / Input Action / MCP 工具。
 *
 * 架构：
 *  - ctx.ui.registerActivityTab()  → om-metadata-browser（元数据浏览器）
 *  - ctx.ui.registerActivityTab()  → om-lineage-viewer（血缘查看器）
 *  - ctx.ui.registerActivityTab()  → om-quality-overview（数据质量概览）
 *  - ctx.ui.registerWorkspaceView() → om-settings（连接配置面板）
 *  - ctx.ui.registerInputAction()  → om-toggle（输入栏按钮）
 *  - ctx.agent.registerTool()     → 13+ MCP 工具（om_search_metadata 等）
 *  - ctx.services                 → 代理进程（server/main.mjs）转发 OM REST API
 *  - ctx.storage                  → 连接配置持久化
 */

import { lazy, Suspense, type ComponentType, type ReactElement } from "react";
import { definePlugin, type Disposable } from "@astravia-org/plugin-sdk";
import { bindOmServices } from "./shared/om-services";
import { registerTools } from "./tools/register-tools";
import { bindConnectionStorage } from "./domain/connection-store";
import "./style.css";

/** 面板加载中占位。 */
function PanelLoading(): ReactElement {
  return (
    <div data-astravia-plugin-root="openmetadata" className="om-root flex h-full w-full flex-col items-center justify-center bg-background text-muted-foreground"
         style={{ contain: "layout style paint" }}>
      <div className="flex items-center gap-2 text-[12px]">
        <span className="icon-[lucide--loader-2] h-4 w-4 animate-spin" />
        加载 OpenMetadata...
      </div>
    </div>
  );
}

/** 懒加载包装 — Loading + ErrorBoundary。 */
function lazyPanel<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): () => ReactElement {
  const Lazy = lazy(load) as unknown as ComponentType<Record<string, never>>;
  return function LazyPanel(): ReactElement {
    return (
      <Suspense fallback={<PanelLoading />}>
        <Lazy />
      </Suspense>
    );
  };
}

const ConnectionConfigPanel = lazyPanel(async () => ({
  default: (await import("./features/connection-config/components/connection-config-panel")).ConnectionConfigPanel as unknown as ComponentType<Record<string, never>>,
}));

const MetadataBrowserPanel = lazyPanel(async () => ({
  default: (await import("./features/metadata-browser/components/metadata-browser")).MetadataBrowser as unknown as ComponentType<Record<string, never>>,
}));

const LineageViewerPanel = lazyPanel(async () => ({
  default: (await import("./features/lineage-viewer/components/lineage-viewer")).LineageViewer as unknown as ComponentType<Record<string, never>>,
}));

const QualityOverviewPanel = lazyPanel(async () => ({
  default: (await import("./features/quality-overview/components/quality-overview")).QualityOverview as unknown as ComponentType<Record<string, never>>,
}));

export default definePlugin({
  async activate(ctx) {
    // 1. 绑定代理服务客户端（MCP 工具 handler 通过 omRequest() 调用）
    bindOmServices(((ctx as { services?: unknown }).services ?? null) as Parameters<typeof bindOmServices>[0]);

    // 2. 绑定连接配置存储（通过宿主 storage API 持久化 connections.json）
    bindConnectionStorage(ctx.storage);

    // 3. 注册 Workspace View：连接配置面板（侧边栏）
    const workspaceView = ctx.ui.registerWorkspaceView({
      id: "om-settings",
      label: "%connection.title%",
      description: "管理 OpenMetadata 数据目录连接",
      component: ConnectionConfigPanel,
    });

    // 4. 注册 Activity Tab：元数据浏览器（主面板）
    const metadataTab = ctx.ui.registerActivityTab({
      id: "om-metadata-browser",
      label: "元数据",
      icon: <span className="icon-[lucide--database] h-3.5 w-3.5" />,
      component: MetadataBrowserPanel,
      scope_use: ["im-claw", "conversation", "project", "cli"],
      retention: "pinned",
      initiallyVisible: false,
    });

    // 5. 注册 Activity Tab：血缘查看器
    const lineageTab = ctx.ui.registerActivityTab({
      id: "om-lineage-viewer",
      label: "血缘",
      icon: <span className="icon-[lucide--git-branch] h-3.5 w-3.5" />,
      component: LineageViewerPanel,
      scope_use: ["im-claw", "conversation", "project", "cli"],
      retention: "pinned",
      initiallyVisible: false,
    });

    // 6. 注册 Activity Tab：数据质量概览
    const qualityTab = ctx.ui.registerActivityTab({
      id: "om-quality-overview",
      label: "质量",
      icon: <span className="icon-[lucide--shield-check] h-3.5 w-3.5" />,
      component: QualityOverviewPanel,
      scope_use: ["im-claw", "conversation", "project", "cli"],
      retention: "pinned",
      initiallyVisible: false,
    });

    // 7. 注册 Input Action：输入栏按钮（@om 快速打开元数据浏览器）
    let inputAction: Disposable | null = null;
    if (ctx.permissions.has("ui.slot.input-action")) {
      inputAction = ctx.ui.registerInputAction({
        id: "om-toggle",
        label: "元数据",
        icon: <span className="icon-[lucide--database] h-3.5 w-3.5" />,
        defaultActive: false,
        scope_use: ["im-claw", "conversation", "project", "cli"],
        onToggle() {
          // ctx.ui.openActivityTab("om-metadata-browser");
        },
      });
    }

    // 8. 注册 13+ 个 MCP 工具
    const toolDisposables = registerTools(ctx);

    ctx.ui.notify({ message: "OpenMetadata 已加载 — 请先在侧边栏添加连接", variant: "info" });

    // 清理函数
    return () => {
      try { workspaceView.dispose(); } catch { /* ignore */ }
      try { metadataTab.dispose(); } catch { /* ignore */ }
      try { lineageTab.dispose(); } catch { /* ignore */ }
      try { qualityTab.dispose(); } catch { /* ignore */ }
      try { inputAction?.dispose(); } catch { /* ignore */ }
      for (const d of toolDisposables) { try { d.dispose(); } catch { /* ignore */ } }
      bindOmServices(null);
      bindConnectionStorage(null);
    };
  },
});
