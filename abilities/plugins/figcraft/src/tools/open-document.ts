import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../app.config.ts";
import { craftFrame } from "../features/editor/session-registry.ts";
import { openDocument, readCanvas } from "../features/editor/services/open-document.ts";
import { rememberDocument } from "../features/editor/services/last-document.ts";
import { base64ToBytes } from "../shared/formatters/base64.ts";
import { basename } from "../shared/formatters/paths.ts";
import { SCOPE } from "./shared/schema.ts";
import { text } from "./shared/reply.ts";

/**
 * Get a file the user owns into the running editor.
 *
 * The page is upstream's build, so the only way in is an input the app itself exposes: a
 * drop on its canvas first, then the platform's open chord, then the menu mnemonics — and
 * each rung is followed by a canvas reading, so "opened" is measured, never assumed.
 */
export function registerOpenDocumentTool(ctx: PluginContext): Disposable {
  const id = APP.id;

  return ctx.agent.registerTool({
    id: `${id}_open_document`,
    label: "%tool.document%",
    description:
      `Open a workspace file in ${APP.name} for real. The bytes are staged in the page and offered the ` +
      `way the app itself accepts a file: a drop on its canvas first, then the platform's open chord, then ` +
      `the menu mnemonics — and every attempt is reported. When the app's own dialog does open, the staged ` +
      `bytes are what it receives. \`opened\` is true only when the canvas measurably changed, so treat ` +
      `false as "not loaded" and let the user open it once by hand. Use this whenever the user names a ` +
      `file to work on; \`${id}_act\` alone cannot load a document.`,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative or absolute path of the file to open." },
      },
      required: ["path"],
      additionalProperties: false,
    },
    scope_use: [...SCOPE],
    timeoutMs: 120000,
    async handler(context) {
      const input = (context.trigger.input ?? {}) as { path?: string };
      if (!input.path) return text({ ok: false, error: "path-required" });
      if (!craftFrame()) return text({ ok: false, error: "editor-not-open" });
      let read;
      try {
        read = await ctx.fs.readBinaryFile(input.path);
      } catch (error) {
        return text({ ok: false, error: `read-failed: ${String((error as Error)?.message ?? error)}` });
      }
      const bytes = base64ToBytes(read.data);
      const name = basename(input.path);
      const result = await openDocument({
        bytes: bytes.buffer as ArrayBuffer,
        name,
        mime: read.mimeType || "",
      });
      // Remembered only when the canvas really took it: a staged-but-unopened file is
      // not the document this panel is showing, and restoring it would be a lie.
      if (result.opened) {
        void rememberDocument(ctx, { path: input.path, name, mime: read.mimeType || "" });
      }
      return text({
        ok: result.opened,
        opened: result.opened,
        step: result.step ?? null,
        bytes: bytes.byteLength,
        attempts: result.attempts,
        /** Still staged in the frame: the app's own File › Open will take it. */
        staged: result.staged,
        probe: await readCanvas(),
        next: result.opened
          ? `The canvas changed, so the file is loaded. Call ${id}_act for the next editing step.`
          : `Nothing the tool tried moved the canvas. The bytes are still staged, so the app's own ` +
            `File › Open (or a drop onto the canvas) will load this exact file; otherwise check that ` +
            `the editor has finished booting and retry.`,
        /**
         * Said on every successful open, because it is the first thing the model blames on
         * itself. The bytes were never mangled: the page renders text with the faces the
         * upstream web build baked into its wasm, and that build ships Latin plus one
         * Japanese face to stay inside the size budget. Simplified-only glyphs (测, 图, 层)
         * therefore have no shape to draw and egui paints tofu or a Japanese variant. It is
         * a font-coverage gap in upstream's build, not an encoding fault, and no amount of
         * rewriting the file changes it.
         */
        glyphs: result.opened
          ? `Text renders with the fonts baked into the upstream web build (Latin + one Japanese ` +
            `face). Simplified-only glyphs can show as boxes or Japanese variants — that is a ` +
            `build font gap, not a broken file. Do not rewrite the document to "fix" it; retrying ` +
            `the same bytes will look identical.`
          : null,
      });
    },
  });
}
