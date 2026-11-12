import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { registerActTool } from "./act.ts";
import { registerEditorStatusTool } from "./editor-status.ts";
import { registerMenuTool } from "./menu.ts";
import { registerOpenDocumentTool } from "./open-document.ts";
import { registerOpenEditorTool } from "./open-editor.ts";
import { registerProbeTool } from "./probe.ts";
import { registerWaitTool } from "./wait.ts";
import { registerRecipeTool } from "./recipe.ts";

/**
 * The tool surface, one file per tool.
 *
 * Eight tools, each addressable on its own, because a plugin's surface is read by two
 * things that both care about shape: the model (one name, one contract) and the next
 * person changing one of them. A single 700-line file made every tool's schema look like
 * every other tool's, and made "add a parameter" a change with blast radius.
 *
 * The count is not the point — the split is. Every craft app ships these eight under its
 * own prefix, and they stay deliberately small: a recipe instead of five round trips, a
 * name instead of a pixel, one reading instead of a screenshot, one wait instead of a sleep.
 */
export function registerCraftTools(ctx: PluginContext): Disposable[] {
  return [
    registerOpenEditorTool(ctx),
    registerEditorStatusTool(ctx),
    registerActTool(ctx),
    registerProbeTool(ctx),
    registerWaitTool(ctx),
    registerOpenDocumentTool(ctx),
    registerMenuTool(ctx),
    registerRecipeTool(ctx),
  ];
}
