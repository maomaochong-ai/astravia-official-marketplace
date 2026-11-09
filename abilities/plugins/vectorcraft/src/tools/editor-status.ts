import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../app.config.ts";
import { askCraftFrame, craftFrame } from "../features/editor/session-registry.ts";
import { readCanvas } from "../features/editor/services/open-document.ts";
import type { ProbeOptions } from "../features/editor/services/open-document.ts";
import { SCOPE, STEP_SCHEMA } from "./shared/schema.ts";
import { readActivity, text } from "./shared/reply.ts";

/**
 * Read-only status: is the tab up, is the document loaded, and what did the page just do.
 *
 * Separate from `open_editor` because the questions are different. Reaching for the tool
 * that opens things in order to ask "is it open" is how a diagnostic turns into a side
 * effect.
 */
export function registerEditorStatusTool(ctx: PluginContext): Disposable {
  void ctx;
  const id = APP.id;

  return ctx.agent.registerTool({
    id: `${id}_editor_status`,
    label: "%tool.status%",
    description:
      `Report the current ${APP.name} tab without changing it: whether it is open, whether the editor ` +
      `finished booting, the page URL, the canvas size, whether a file is staged for the next open, the ` +
      `last few things the page did, and a coarse text map of the canvas with its average colour. ` +
      `Read-only — it never opens, clicks or reloads.`,
    parameters: {
      type: "object",
      properties: {
        region: STEP_SCHEMA.properties.region,
        columns: { type: "number", description: "Map width in cells, 4–64. Defaults to 32." },
        rows: { type: "number", description: "Map height in cells, 2–36. Defaults to 18." },
      },
      additionalProperties: false,
    },
    scope_use: [...SCOPE],
    timeoutMs: 20000,
    async handler(context) {
      const input = (context.trigger.input ?? {}) as ProbeOptions;
      const frame = craftFrame();
      if (!frame) return text({ open: false });
      try {
        const reply = await askCraftFrame("craft:inspect", {}, 8000);
        const probe =
          reply.ready === true
            ? await readCanvas({ region: input.region, columns: input.columns, rows: input.rows })
            : null;
        // The page keeps its own short log; asking it is the only way to know what
        // happened before this call without guessing from the picture.
        const recent = reply.ready === true ? await readActivity() : [];
        return text({
          open: true,
          url: reply.href ?? frame.baseUrl(),
          ready: reply.ready === true,
          canvas: reply.canvas ?? null,
          staged: reply.staged ?? null,
          recent,
          probe,
        });
      } catch (error) {
        return text({ open: true, error: String((error as Error)?.message ?? error) });
      }
    },
  });
}
