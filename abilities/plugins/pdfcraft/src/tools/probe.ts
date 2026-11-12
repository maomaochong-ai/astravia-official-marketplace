import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../app.config.ts";
import { craftFrame } from "../features/editor/session-registry.ts";
import { askCraftFrame } from "../features/editor/session-registry.ts";
import { readCanvas } from "../features/editor/services/open-document.ts";
import type { ProbeOptions } from "../features/editor/services/open-document.ts";
import { previewCanvasShot, saveCanvasShot } from "../features/editor/services/canvas-shot.ts";
import { evaluateExpectation, writeBaseline } from "../features/editor/services/expectation.ts";
import type { Expectation } from "../features/editor/services/expectation.ts";
import { appendJournal } from "../features/editor/services/run-journal.ts";
import { bytesToBase64 } from "../shared/formatters/base64.ts";
import { basename } from "../shared/formatters/paths.ts";
import type { LinkMessage } from "../domain/link-protocol.ts";
import { EXPECT_SCHEMA, SCOPE, STEP_SCHEMA } from "./shared/schema.ts";
import { readingFor } from "./shared/reading.ts";
import { text } from "./shared/reply.ts";

/**
 * Look, without touching.
 *
 * Two readers: the model gets a letter map and a mean colour, the person gets the same
 * frame as a PNG. `remember_as` turns one look into a baseline; `expect` turns another
 * look into a verdict.
 */
export function registerProbeTool(ctx: PluginContext): Disposable {
  const id = APP.id;

  return ctx.agent.registerTool({
    id: `${id}_probe`,
    label: "%tool.probe%",
    description:
      `Look at the ${APP.name} canvas without changing it: a text map (one letter per cell — uppercase is ` +
      `bright, lowercase dark, K black, W white, R/G/B/C/M/Y/P hues, N neutral), the average colour of the ` +
      `region, and its contrast. Use \`region\` to inspect one part closely — the tool rail, a slider, the ` +
      `canvas centre — and a small \`columns\`/\`rows\` for a coarse overview. ` +
      `Set \`save\` when the user asked for a screenshot: that writes a real PNG the user picks a location ` +
      `for, which the model does not receive. ` +
      `Every call also writes a PNG into the project (\`.craft/${APP.id}/shots/\`, newest six kept), returns its ` +
      `path as \`shot\`, and opens it in Astravia's own previewer so the user sees the editor too. ` +
      `Read the file when the answer depends on how the canvas actually looks. ` +
      `Two more fields turn a look into a check: \`remember_as\` saves this reading under a name ` +
      `(\`.craft/${APP.id}/baseline/<name>.json\`), and \`expect\` compares this reading with a colour ` +
      `or with one of those baselines and reports \`assert\`. A named baseline belongs to the project: ` +
      `save one when the canvas is right, then ask \`expect\` with \`against: "baseline"\` after the ` +
      `next change. It compares readings, not pixels; for pixels, read the \`shot\` file.`,
    parameters: {
      type: "object",
      properties: {
        region: STEP_SCHEMA.properties.region,
        columns: { type: "number", description: "Map width in cells, 4–64. Defaults to 32." },
        rows: { type: "number", description: "Map height in cells, 2–36. Defaults to 18." },
        save: { type: "boolean", description: "Also write a PNG the user chooses a path for." },
        file_name: { type: "string", description: `PNG name when saving, e.g. "${id}-view.png".` },
        scale: { type: "number", description: "PNG magnification when saving, 1–4." },
        preview: {
          type: "boolean",
          description: "Open the capture in Astravia's own previewer so the user can see it. Defaults to true.",
        },
        remember_as: {
          type: "string",
          description: "Save this reading as the baseline called this (default name `current`).",
        },
        expect: EXPECT_SCHEMA,
      },
      additionalProperties: false,
    },
    scope_use: [...SCOPE],
    timeoutMs: 60000,
    async handler(context) {
      const input = (context.trigger.input ?? {}) as ProbeOptions & {
        save?: boolean;
        file_name?: string;
        scale?: number;
        preview?: boolean;
        remember_as?: string;
        expect?: Expectation | null;
      };
      if (!craftFrame()) return text({ ok: false, error: "editor-not-open" });
      const probe = await readCanvas({ region: input.region, columns: input.columns, rows: input.rows });
      if (!probe) return text({ ok: false, error: "probe-failed" });
      // The text map is the cheap reading; the picture is the one a person would look at.
      const shot = await saveCanvasShot(ctx, { region: input.region, scale: input.scale, tag: "probe" });
      const previewed = input.preview === false ? false : previewCanvasShot(ctx, shot);
      // A baseline is a reading, so saving one costs a file write, not a capture.
      const baseline = input.remember_as ? await writeBaseline(ctx, probe, input.remember_as) : null;
      const assert = await evaluateExpectation(ctx, input.expect, await readingFor(input.expect, probe));
      const journal = await appendJournal(ctx, {
        tool: "probe",
        region: input.region ?? null,
        grid: [probe.cols, probe.rows],
        mean: probe.mean,
        drift: typeof probe.drift === "number" ? probe.drift : null,
        assert,
        baseline,
        shot: shot?.path ?? null,
      });
      if (!input.save) {
        return text({ ok: true, probe, assert, baseline, shot: shot?.path ?? null, previewed, journal });
      }
      const name = input.file_name || `${id}-view.png`;
      let reply: LinkMessage;
      try {
        reply = await askCraftFrame(
          "craft:capture",
          { name, region: input.region, scale: input.scale ?? 1 },
          30000,
        );
      } catch (error) {
        return text({ ok: false, probe, error: String((error as Error)?.message ?? error) });
      }
      if (!reply.bytes) return text({ ok: false, probe, error: reply.error ?? "empty-capture" });
      const base64 = bytesToBase64(new Uint8Array(reply.bytes));
      const saved = await ctx.fs.saveAs(name, base64, "base64", {
        title: name,
        filters: [{ name: "PNG image", extensions: ["png"] }],
      });
      if (!saved) return text({ ok: false, probe, error: "save-cancelled" });
      return text({
        ok: true,
        probe,
        assert,
        baseline,
        shot: shot?.path ?? null,
        previewed,
        path: saved,
        name: basename(saved),
        journal,
      });
    },
  });
}
