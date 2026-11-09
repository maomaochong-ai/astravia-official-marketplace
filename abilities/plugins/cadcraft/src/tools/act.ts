import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../app.config.ts";
import { craftFrame } from "../features/editor/session-registry.ts";
import { askCraftFrame } from "../features/editor/session-registry.ts";
import { describeDelta, readCanvas } from "../features/editor/services/open-document.ts";
import { previewCanvasShot, saveCanvasShot } from "../features/editor/services/canvas-shot.ts";
import { evaluateExpectation } from "../features/editor/services/expectation.ts";
import type { Expectation } from "../features/editor/services/expectation.ts";
import { appendJournal } from "../features/editor/services/run-journal.ts";
import { editorStrings } from "../features/editor/strings.ts";
import type { LinkMessage } from "../domain/link-protocol.ts";
import { EXPECT_SCHEMA, SCOPE, STEP_SCHEMA } from "./shared/schema.ts";
import { readingFor } from "./shared/reading.ts";
import { text } from "./shared/reply.ts";

/**
 * The one tool that changes anything.
 *
 * A batch, not a click: the page runs the steps in order, paced by frames, narrating each
 * one on the canvas, and the result reports the picture before and after. `change` says
 * something happened; `assert` (from `expect`) says the right thing happened.
 *
 * ADR: docs/adr/<slug>/craft-0009-one-batch-and-a-text-map.md
 * ADR: docs/adr/<slug>/craft-0025-settled-means-quiet-not-identical.md
 * ADR: docs/adr/<slug>/craft-0026-act-says-what-it-expects.md
 */
export function registerActTool(ctx: PluginContext): Disposable {
  const id = APP.id;
  // The HUD lives inside the page and has no locale of its own: the tab tells it what to
  // say, in the language the panel is in.
  const strings = editorStrings(ctx.i18n.locale);
  const hud = { prefix: strings.acting, done: strings.actDone };

  return ctx.agent.registerTool({
    id: `${id}_act`,
    label: "%tool.act%",
    description:
      `Run an ordered batch of pointer and keyboard steps inside the open ${APP.name} editor, then report ` +
      `what changed. This is the only tool that changes anything: click, move, drag, scroll, type, key, ` +
      `wait, ready, capture and label are all steps of one call. ` +
      `Coordinates are fractions of the canvas (0–1), taken from the text map this tool returns — ` +
      `the map is 32 columns by 18 rows, so column c row r is x=(c+0.5)/32, y=(r+0.5)/18. ` +
      `Give every step a \`label\` in the user's language: it is shown on the canvas while the step runs, ` +
      `which is how the person watching sees what the agent is doing. ` +
      `The result carries the canvas map and mean colour from before and after the batch, so read ` +
      `\`change.distance\` to tell whether anything actually happened before calling it a success. ` +
      `Batch related steps (open a tool, move a slider, commit) instead of one call per click. ` +
      `\`cellsMoved\` is the share of map cells that changed; a click that moved nothing leaves it at 0. ` +
      `Pass \`expect\` when you know what the result should look like: the reply then carries \`assert\`, ` +
      `which answers "did it do the right thing" rather than "did anything happen" — the two differ, ` +
      `and a click on the wrong layer moves the picture just as much as the right one. When ` +
      `\`assert.ok\` is false, change the approach instead of repeating the same coordinates. ` +
      `The result also carries \`shot\`: a PNG of the canvas written into the project. Read that file ` +
      `when the question is about looks — alignment, type, banding — not about whether anything moved.`,
    parameters: {
      type: "object",
      properties: {
        steps: { type: "array", minItems: 1, maxItems: 40, items: STEP_SCHEMA },
        stop_on_error: {
          type: "boolean",
          description: "Stop at the first failed step instead of running the rest. Defaults to true.",
        },
        probe: {
          type: "boolean",
          description: "Report the canvas map and colour after the batch. Defaults to true.",
        },
        shot: {
          type: "boolean",
          description: "Capture the canvas and return its path. Defaults to true.",
        },
        preview: {
          type: "boolean",
          description:
            "Open that capture in Astravia's own previewer so the user can see the editor. Defaults to true.",
        },
        expect: EXPECT_SCHEMA,
      },
      required: ["steps"],
      additionalProperties: false,
    },
    scope_use: [...SCOPE],
    timeoutMs: 120000,
    async handler(context) {
      const input = (context.trigger.input ?? {}) as {
        steps?: unknown[];
        stop_on_error?: boolean;
        probe?: boolean;
        shot?: boolean;
        preview?: boolean;
        expect?: Expectation | null;
      };
      if (!Array.isArray(input.steps) || input.steps.length === 0) {
        return text({ ok: false, error: "steps-required" });
      }
      const frame = craftFrame();
      if (!frame) return text({ ok: false, error: "editor-not-open" });
      const before = await readCanvas();
      let reply: LinkMessage;
      try {
        reply = await askCraftFrame(
          "craft:act",
          {
            steps: input.steps,
            stopOnError: input.stop_on_error !== false,
            hud,
          },
          90000,
        );
      } catch (error) {
        return text({ ok: false, error: String((error as Error)?.message ?? error) });
      }
      if (reply.ok === false && !reply.steps) {
        return text({ ok: false, error: reply.error ?? "act-failed" });
      }
      const after = input.probe === false ? null : await readCanvas();
      const shot = input.shot === false ? null : await saveCanvasShot(ctx, { tag: "act" });
      const previewed = input.preview === false ? false : previewCanvasShot(ctx, shot);
      const change = describeDelta(before, after);
      // The assertion is judged against the reading `change` was computed from — or a
      // focused one, when `expect.region` names a rectangle — so the two verdicts in one
      // reply can never describe different frames.
      const assert = await evaluateExpectation(ctx, input.expect, await readingFor(input.expect, after));
      const journal = await appendJournal(ctx, {
        tool: "act",
        steps: (input.steps as Array<{ op?: string }>).map((step) => step?.op ?? "?"),
        ok: reply.ok !== false,
        elapsedMs: reply.elapsedMs ?? null,
        change,
        assert,
        shot: shot?.path ?? null,
      });
      return text({
        ok: reply.ok !== false,
        steps: reply.steps ?? [],
        elapsedMs: reply.elapsedMs ?? null,
        change,
        assert,
        probe: after,
        shot: shot?.path ?? null,
        previewed,
        journal,
      });
    },
  });
}
