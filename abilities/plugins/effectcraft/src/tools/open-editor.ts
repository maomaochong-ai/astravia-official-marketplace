import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../app.config.ts";
import { askCraftFrame, waitForCraftFrame } from "../features/editor/session-registry.ts";
import { openDocument, readCanvas } from "../features/editor/services/open-document.ts";
import { readWorkspaceFile, selectionAccess } from "../features/editor/services/workspace-files.ts";
import { SCOPE } from "./shared/schema.ts";
import { text } from "./shared/reply.ts";

/**
 * The door. Every other tool needs the tab, so this is the one that opens it — and the one
 * that offers the file the user already selected, because opening the panel with a
 * document selected should do the obvious thing.
 */
export function registerOpenEditorTool(ctx: PluginContext): Disposable {
  const id = APP.id;

  return ctx.agent.registerTool({
    id: `${id}_open_editor`,
    label: "%tool.open%",
    description:
      `Open the ${APP.name} editor in an Astravia activity tab and report whether it started. ` +
      `Use this first when the user asks to work on ${APP.name} material; every other ${APP.name} tool ` +
      `needs this tab open. If exactly one file is selected in the Explorer it is offered to the editor ` +
      `and \`opened\` says whether the canvas took it; \`attempts\` lists what was tried. Returns the page ` +
      `URL, whether the editor finished booting, the canvas size, and a text map of what is on screen.`,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    scope_use: [...SCOPE],
    timeoutMs: 60000,
    async handler() {
      ctx.ui.openActivityTab(APP.tabId, { width: "max" });
      const frame = await waitForCraftFrame(15000);
      if (!frame) return text({ open: false, error: "tab-did-not-mount" });
      try {
        const reply = await askCraftFrame("craft:inspect", {}, 20000);
        const ready = reply.ready === true;
        // A selected file is the user's intent; offering it here is what makes opening the
        // panel with a document selected do the obvious thing.
        const file = ready ? selectionAccess(ctx).current() : null;
        const loaded = file ? await readWorkspaceFile(ctx, file) : null;
        const opened =
          loaded && file
            ? await openDocument({ bytes: loaded.bytes, name: file.name, mime: loaded.mimeType })
            : null;
        const probe = ready ? await readCanvas() : null;
        return text({
          open: true,
          url: reply.href ?? frame.baseUrl(),
          ready,
          canvas: reply.canvas ?? null,
          secure: reply.secure === true,
          staged: reply.staged ?? null,
          file: file?.name ?? null,
          opened: opened?.opened ?? null,
          attempts: opened?.attempts ?? null,
          probe,
          next: !ready
            ? `Still booting. Call ${id}_open_editor again or ${id}_editor_status before acting.`
            : opened && !opened.opened
              ? `The editor is up but did not take "${file?.name}" automatically: use its own ` +
                `File › Open, where the selection is already waiting.`
              : `The editor is up${opened?.opened ? ` with "${file?.name}"` : ""}. Call ${id}_act to ` +
                `drive it; read the returned text map after each batch.`,
        });
      } catch (error) {
        return text({ open: true, ready: false, error: String((error as Error)?.message ?? error) });
      }
    },
  });
}

