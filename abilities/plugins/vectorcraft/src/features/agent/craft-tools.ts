import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../../app.config.ts";
import { ensureHub } from "../../runtime.ts";
import { basename } from "../../shared/formatters/paths.ts";
import { bytesToBase64, base64ToBytes } from "../../shared/formatters/base64.ts";
import { askCraftFrame, craftFrame, waitForCraftFrame } from "../editor/session-registry.ts";

/**
 * The natural-language surface: five tools the Agent can call to drive the same
 * editor the tab shows. Every one of them goes through the real page over
 * postMessage — no tool reports a state it did not read back from the frame.
 *
 * Tool names are prefixed with the app id because all craft plugins are installed
 * at once and the host keeps one flat tool namespace.
 *
 * ADR: docs/adr/craft/0001-one-generator-seven-plugins.md
 */
const SCOPE = ["conversation", "project"] as const;

function text(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

export function registerCraftTools(ctx: PluginContext): Disposable[] {
  const id = APP.id;
  const disposables: Disposable[] = [];

  disposables.push(
    ctx.agent.registerTool({
      id: `${id}_open_editor`,
      label: `Open ${APP.name}`,
      description:
        `Open the ${APP.name} editor in an Astravia activity tab and report whether it started. ` +
        `Use this first when the user asks to work on ${APP.name} material; the other ${APP.name} tools ` +
        `need this tab to be open. Returns the page URL, whether the editor finished booting, and its canvas size.`,
      parameters: { type: "object", properties: {}, additionalProperties: false },
      scope_use: [...SCOPE],
      timeoutMs: 60000,
      async handler() {
        ctx.ui.openActivityTab(APP.tabId, { width: "max" });
        const frame = await waitForCraftFrame(15000);
        if (!frame) return text({ open: false, error: "tab-did-not-mount" });
        try {
          const reply = await askCraftFrame("craft:inspect", {}, 20000);
          return text({
            open: true,
            url: reply.href ?? frame.baseUrl(),
            ready: reply.ready === true,
            canvas: reply.canvas ?? null,
            secure: reply.secure === true,
            staged: reply.staged ?? null,
          });
        } catch (error) {
          return text({ open: true, ready: false, error: String((error as Error)?.message ?? error) });
        }
      },
    }),
  );

  disposables.push(
    ctx.agent.registerTool({
      id: `${id}_editor_status`,
      label: `${APP.name} status`,
      description:
        `Report the current ${APP.name} tab: whether it is open, whether the editor finished booting, ` +
        `the page URL, the canvas size, and whether a file is staged for the next open dialog. ` +
        `Read-only — it never opens or reloads the tab.`,
      parameters: { type: "object", properties: {}, additionalProperties: false },
      scope_use: [...SCOPE],
      timeoutMs: 20000,
      async handler() {
        const frame = craftFrame();
        if (!frame) return text({ open: false });
        try {
          const reply = await askCraftFrame("craft:inspect", {}, 8000);
          return text({
            open: true,
            url: reply.href ?? frame.baseUrl(),
            ready: reply.ready === true,
            canvas: reply.canvas ?? null,
            staged: reply.staged ?? null,
          });
        } catch (error) {
          return text({ open: true, error: String((error as Error)?.message ?? error) });
        }
      },
    }),
  );

  disposables.push(
    ctx.agent.registerTool({
      id: `${id}_capture_canvas`,
      label: `Capture ${APP.name} canvas`,
      description:
        `Save a PNG of what the ${APP.name} canvas is showing right now, as a new file the user picks a ` +
        `location for. Use it when the user asks to see, save or share the current view. It captures the ` +
        `visible canvas only — not a full export with layers, and not a video frame sequence.`,
      parameters: {
        type: "object",
        properties: {
          file_name: {
            type: "string",
            description: `File name for the PNG, e.g. "${id}-view.png". Defaults to "${id}-canvas.png".`,
          },
        },
        additionalProperties: false,
      },
      scope_use: [...SCOPE],
      timeoutMs: 60000,
      async handler(context) {
        const input = (context.trigger.input ?? {}) as { file_name?: string };
        const frame = craftFrame();
        if (!frame) return text({ ok: false, error: "editor-not-open" });
        let reply;
        try {
          reply = await askCraftFrame("craft:capture", { name: input.file_name || `${id}-canvas.png` }, 30000);
        } catch (error) {
          return text({ ok: false, error: String((error as Error)?.message ?? error) });
        }
        if (!reply.bytes) return text({ ok: false, error: reply.error || "empty-capture" });
        const name = input.file_name || `${id}-canvas.png`;
        const base64 = bytesToBase64(new Uint8Array(reply.bytes));
        const saved = await ctx.fs.saveAs(name, base64, "base64", {
          title: name,
          filters: [{ name: "PNG image", extensions: ["png"] }],
        });
        if (!saved) return text({ ok: false, error: "save-cancelled" });
        return text({ ok: true, path: saved, name: basename(saved) });
      },
    }),
  );

  disposables.push(
    ctx.agent.registerTool({
      id: `${id}_open_workspace_file`,
      label: `Hand a file to ${APP.name}`,
      description:
        `Read a workspace file and stage it for ${APP.name}. The next time the editor opens a file ` +
        `(File → Open, or the user presses the open control), it receives this file directly instead of ` +
        `showing a picker. Staging does not open anything by itself — say so when you report back.`,
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative or absolute path of the file to stage." },
        },
        required: ["path"],
        additionalProperties: false,
      },
      scope_use: [...SCOPE],
      timeoutMs: 60000,
      async handler(context) {
        const input = (context.trigger.input ?? {}) as { path?: string };
        if (!input.path) return text({ ok: false, error: "path-required" });
        const frame = craftFrame();
        if (!frame) return text({ ok: false, error: "editor-not-open" });
        let read;
        try {
          read = await ctx.fs.readBinaryFile(input.path);
        } catch (error) {
          return text({ ok: false, error: `read-failed: ${String((error as Error)?.message ?? error)}` });
        }
        const bytes = base64ToBytes(read.data);
        const name = basename(input.path);
        try {
          const reply = await askCraftFrame(
            "craft:stage",
            { name, mime: read.mimeType || "", bytes: bytes.buffer },
            10000,
          );
          if (reply.ok === false) return text({ ok: false, error: reply.error || "stage-failed" });
        } catch (error) {
          return text({ ok: false, error: String((error as Error)?.message ?? error) });
        }
        return text({
          ok: true,
          staged: name,
          bytes: bytes.byteLength,
          next: `Ask the user to choose Open in ${APP.name}; the staged file is handed over instead of a picker.`,
        });
      },
    }),
  );

  disposables.push(
    ctx.agent.registerTool({
      id: `${id}_open_in_browser`,
      label: `${APP.name} in a browser`,
      description:
        `Open the running ${APP.name} page in Astravia's built-in browser panel, or in the user's system ` +
        `browser. The browser page has no workspace binding: files there come from the browser's own picker ` +
        `and saves go to the download folder. Use it only when the user asks for a browser window.`,
      parameters: {
        type: "object",
        properties: {
          where: { type: "string", enum: ["panel", "system"], description: "Which browser to use." },
        },
        required: ["where"],
        additionalProperties: false,
      },
      scope_use: [...SCOPE],
      timeoutMs: 60000,
      async handler(context) {
        const input = (context.trigger.input ?? {}) as { where?: string };
        const url = await ensureHub(ctx);
        if (input.where === "system") {
          ctx.ui.openExternal(url);
          return text({ ok: true, where: "system", url });
        }
        ctx.browser.open(url);
        return text({ ok: true, where: "panel", url });
      },
    }),
  );

  return disposables;
}
