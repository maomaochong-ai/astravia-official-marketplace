import type { Disposable, PluginContext, PluginAgentToolHandler, PluginJsonSchema } from "@astravia-org/plugin-sdk";
import { ALL_TOOLS } from "./om-tools";

/**
 * 工具内部 handler 签名：(params) => Promise<result>。
 * plugin-sdk 签名：(context: { trigger: { input: params } }) => ...。
 * 用此类型桥接两边。
 */
type InternalToolHandler = (params: never) => Promise<unknown>;

interface OmToolDef {
  name: string;
  description: string;
  parameters: PluginJsonSchema;
  handler: InternalToolHandler;
}

/**
 * 把内部 (params) 签名的 handler 包装成 plugin-sdk 要求的 context-based 签名。
 */
function adaptHandler<TInput>(internal: InternalToolHandler): PluginAgentToolHandler<TInput> {
  return async (context) => {
    return await internal(context.trigger.input as never);
  };
}

/**
 * 注册所有 OpenMetadata MCP 工具到宿主 Agent。
 * 返回 Disposable[]（插件停用时宿主用来清理）。
 *
 * 注意：RDF 工具（om_sparql_query）默认在 ALL_TOOLS 中包含。
 * 若插件前端检测到 OM 实例未启用 RDF，可在传入 toolsOverride 中过滤掉。
 */
export function registerTools(ctx: PluginContext, toolsOverride?: typeof ALL_TOOLS): Disposable[] {
  const tools = (toolsOverride ?? ALL_TOOLS) as readonly OmToolDef[];
  const disposables: Disposable[] = [];

  for (const tool of tools) {
    disposables.push(
      ctx.agent.registerTool({
        id: tool.name,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        handler: adaptHandler(tool.handler),
      }),
    );
  }

  return disposables;
}
