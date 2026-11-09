import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../app.config.ts";
import { craftFrame } from "../features/editor/session-registry.ts";
import { describeDelta, readCanvas } from "../features/editor/services/open-document.ts";
import { previewCanvasShot, saveCanvasShot } from "../features/editor/services/canvas-shot.ts";
import { appendJournal } from "../features/editor/services/run-journal.ts";
import { CHANGE_DISTANCE, CHANGE_DRIFT, SCOPE } from "./shared/schema.ts";
import { text } from "./shared/reply.ts";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wait until the canvas stops moving, then say what it settled on.
 *
 * "Stopped" is measured with the same tolerance `change.changed` uses: a canvas redraws
 * with antialiasing and dither on every frame, so exact equality either never arrives or
 * arrives on a half-drawn frame. A timeout is an answer, not an error.
 *
 * ADR: docs/adr/<slug>/craft-0025-settled-means-quiet-not-identical.md
 */
export function registerWaitTool(ctx: PluginContext): Disposable {
  const id = APP.id;

  return ctx.agent.registerTool({
    id: `${id}_wait`,
    label: "%tool.wait%",
    description:
      `Wait until the ${APP.name} canvas stops changing, then report what it settled on. ` +
      `Call it after \`${id}_act\` when that batch started something that takes time — apply ` +
      `a filter, render a preview, re-lay a page — so the next look is at the finished ` +
      `picture rather than a half-drawn one. ` +
      `\`quiet_ms\` is how long the canvas must stay quiet to count as settled (default ` +
      `600 ms), \`probe_interval_ms\` is how often it looks (default 250 ms) and ` +
      `\`timeout_ms\` bounds the wait (default 20000 ms). "Quiet" is measured, not exact: a look ` +
      `counts as movement only when the average colour travels more than ${CHANGE_DISTANCE} or more ` +
      `than ${Math.round(CHANGE_DRIFT * 100)}% of the cells change letter — the same two numbers ` +
      `\`change.changed\` uses, because a canvas redraws with antialiasing and dither on every frame ` +
      `and exact equality either never arrives or arrives too early. ` +
      `A timeout is not an error: the reply carries \`settled: false\` and the last map, so a ` +
      `canvas that animates forever is reported as still moving instead of being retried. ` +
      `\`maxDrift\` and \`maxDistance\` say how violently it was moving — a big number means the ` +
      `wait timed out on an animation, a small one means it kept twitching. ` +
      `The reply carries \`change\`: how far the canvas travelled between the first and the ` +
      `last look — the honest answer to "did that batch do anything?" when the batch itself ` +
      `reported no error. ` +
      `It only reads: no clicks, no keys, no text.`,
    parameters: {
      type: "object",
      properties: {
        quiet_ms: {
          type: "number",
          description: "How long the canvas must stay quiet to count as settled. Defaults to 600.",
        },
        probe_interval_ms: { type: "number", description: "How often to look. Defaults to 250." },
        timeout_ms: { type: "number", description: "Give up waiting after this long. Defaults to 20000." },
        probe: { type: "boolean", description: "Include the final text map. Defaults to true." },
        shot: { type: "boolean", description: "Capture the canvas once it settles. Defaults to false." },
        preview: {
          type: "boolean",
          description: "Open that capture in Astravia's own previewer. Defaults to true.",
        },
      },
      additionalProperties: false,
    },
    scope_use: [...SCOPE],
    timeoutMs: 60000,
    async handler(context) {
      const input = (context.trigger.input ?? {}) as {
        quiet_ms?: number;
        probe_interval_ms?: number;
        timeout_ms?: number;
        probe?: boolean;
        shot?: boolean;
        preview?: boolean;
      };
      if (!craftFrame()) return text({ ok: false, error: "editor-not-open" });
      const quietMs = Math.min(5000, Math.max(200, Math.round(input.quiet_ms ?? 600)));
      const intervalMs = Math.min(2000, Math.max(100, Math.round(input.probe_interval_ms ?? 250)));
      const timeoutMs = Math.min(55000, Math.max(1000, Math.round(input.timeout_ms ?? 20000)));

      const started = Date.now();
      const first = await readCanvas();
      if (!first) return text({ ok: false, error: "probe-failed" });
      let previous = first;
      let last = first;
      let stableSince = Date.now();
      let settled = false;
      let looks = 1;
      let maxDrift = 0;
      let maxDistance = 0;

      while (Date.now() - started < timeoutMs) {
        await sleep(intervalMs);
        const current = await readCanvas();
        if (!current) return text({ ok: false, error: "probe-failed", elapsedMs: Date.now() - started });
        looks += 1;
        last = current;
        // "Quiet" is `change.changed === false`: the same tolerance `act` reports, so a
        // frame this loop calls still cannot be called changed by the batch before it.
        const delta = describeDelta(previous, current);
        if (delta) {
          maxDrift = Math.max(maxDrift, delta.cellsMoved ?? 0);
          maxDistance = Math.max(maxDistance, delta.distance);
        }
        if (!delta || delta.changed) stableSince = Date.now();
        previous = current;
        if (Date.now() - stableSince >= quietMs) {
          settled = true;
          break;
        }
      }

      const elapsedMs = Date.now() - started;
      const shot = settled && input.shot ? await saveCanvasShot(ctx, { tag: "wait" }) : null;
      const previewed = shot ? (input.preview === false ? false : previewCanvasShot(ctx, shot)) : false;
      const change = describeDelta(first, last);
      const journal = await appendJournal(ctx, {
        tool: "wait",
        settled,
        elapsedMs,
        looks,
        maxDrift,
        maxDistance,
        change,
      });
      return text({
        ok: true,
        settled,
        elapsedMs,
        looks,
        quietMs,
        maxDrift,
        maxDistance,
        change,
        probe: input.probe === false ? null : last,
        shot: shot?.path ?? null,
        previewed,
        journal,
      });
    },
  });
}
