import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { ALL_TOOLS } from "./om-tools";

/**
 * 注册所有 OpenMetadata MCP 工具到宿主 Agent。
 * 返回 Disposable[]（插件停用时宿主用来清理）。
 *
 * 注意：RDF 工具（om_sparql_query）默认在 ALL_TOOLS 中包含。
 * 若插件前端检测到 OM 实例未启用 RDF，可在传入 toolsOverride 中过滤掉。
 */
export function registerTools(ctx: PluginContext, toolsOverride?: typeof ALL_TOOLS): Disposable[] {
  const tools = toolsOverride ?? ALL_TOOLS;
  const disposables: Disposable[] = [];

  for (const tool of tools) {
    disposables.push(
      ctx.agent.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        handler: tool.handler,
      }),
    );
  }

  return disposables;
}
