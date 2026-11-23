import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createRenderHtmlTool } from "./render-html";
import { createRenderUiTool } from "./render-ui";

export function registerTools(ctx: PluginContext): Disposable[] {
    return [ctx.agent.registerTool(createRenderUiTool()), ctx.agent.registerTool(createRenderHtmlTool())];
}
