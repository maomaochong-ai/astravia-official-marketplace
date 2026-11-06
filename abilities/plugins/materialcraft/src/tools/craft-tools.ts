import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../app.config.ts";
import { basename } from "../shared/formatters/paths.ts";
import { bytesToBase64, base64ToBytes } from "../shared/formatters/base64.ts";
import { askCraftFrame, craftFrame, waitForCraftFrame } from "../features/editor/session-registry.ts";
import {
  describeDelta,
  openDocument,
  readCanvas,
  releaseStage,
  type ProbeOptions,
} from "../features/editor/services/open-document.ts";
import { readWorkspaceFile, selectionAccess } from "../features/editor/services/workspace-files.ts";
import { editorStrings } from "../features/editor/strings.ts";
import { isCraftNote } from "../domain/link-protocol.ts";
import type { CraftNote, LinkMessage } from "../domain/link-protocol.ts";
import { previewCanvasShot, saveCanvasShot } from "../features/editor/services/canvas-shot.ts";
import { rememberDocument } from "../features/editor/services/last-document.ts";

/**
 * The natural-language surface: six tools, one of which (`act`) carries the whole
 * gesture vocabulary. The Agent drives the same page the tab shows, through the
 * bridge, and never reports a state it did not read back from the frame.
 *
 * Why six and not eleven: every craft plugin installed at once shares one flat tool
 * namespace, and the model's prompt pays for each name. Eleven tools per app across
 * fifteen apps is a menu nobody reads — `click`, `type` and `press_key` became the
 * `click` / `type` / `key` steps of one batch, and the batch is also what makes the
 * driving visible: it runs inside the page, paced by frames, with the shell narrating
 * each step, instead of one synchronous jump per round trip. `wait` is the one addition
 * after that: a batch returns as soon as its last step is dispatched, so the missing
 * verb was never another gesture but "give it a moment, then look again".
 *
 * How the Agent is expected to work: `act` → read the returned text map and colour →
 * `act` again. A plugin tool result reaches the model as text only, so pixels are
 * useless as an answer: the page describes itself instead (see `craft:probe`), and a
 * batch always reports the canvas before and after so a change is measurable rather
 * than assumed.
 *
 * Tool names are prefixed with the app id because all craft plugins can be installed
 * at once. `label` is a `%catalogKey%` so the tool headers follow the host locale.
 *
 * ADR: docs/adr/<slug>/craft-0005-the-agent-drives-the-canvas.md
 * ADR: docs/adr/<slug>/craft-0009-one-batch-instead-of-one-click.md
 */
const SCOPE = ["conversation", "project"] as const;

function text(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * The page's own log of what it just did, or an empty list when the frame cannot
 * answer. Never throws: a missing history is a smaller problem than a failed status.
 */
async function readActivity(limit = 8): Promise<CraftNote[]> {
  try {
    const reply = await askCraftFrame("craft:activity", { limit }, 5000);
    return Array.isArray(reply.notes) ? reply.notes.filter(isCraftNote).slice(-limit) : [];
  } catch {
    return [];
  }
}

/** Steps the bridge understands; the schema below is the contract the model sees. */
const STEP_SCHEMA = {
  type: "object",
  properties: {
    op: {
      type: "string",
      enum: ["click", "move", "drag", "scroll", "type", "key", "wait", "ready", "capture", "label"],
      description:
        "click/move take x,y; drag takes from,to; scroll takes dx,dy at x,y; type takes text; " +
        "key takes a key or chord; wait takes ms; ready waits for the app to finish booting; " +
        "capture saves a PNG step-by-step into the result; label only narrates.",
    },
    label: { type: "string", description: "What this step does, in the user's language. Shown on the canvas HUD." },
    x: { type: "number", description: "Horizontal position, 0 (left) to 1 (right)." },
    y: { type: "number", description: "Vertical position, 0 (top) to 1 (bottom)." },
    double: { type: "boolean" },
    button: { type: "number", description: "0 left, 1 middle, 2 right. Defaults to 0." },
    from: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
    to: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
    moves: { type: "number", description: "Interpolated moves for a drag, 3–24. Defaults to 8." },
    dx: { type: "number" },
    dy: { type: "number" },
    text: { type: "string", description: "Printable ASCII; upstream receives keystrokes, not text." },
    key: { type: "string", description: `"Enter", "Escape", a letter, or a chord such as "ctrl+s".` },
    ms: { type: "number" },
    timeoutMs: { type: "number" },
    region: {
      type: "object",
      description: "Fractional rectangle of the canvas to capture, e.g. the tool rail.",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        w: { type: "number" },
        h: { type: "number" },
      },
      required: ["x", "y", "w", "h"],
    },
    scale: { type: "number", description: "Capture magnification, 1–4." },
    name: { type: "string" },
  },
  required: ["op"],
  additionalProperties: false,
} as const;

export function registerCraftTools(ctx: PluginContext): Disposable[] {
  const id = APP.id;
  // The HUD lives inside the page and has no locale of its own: the tab tells it
  // what to say, in the language the panel is in.
  const strings = editorStrings(ctx.i18n.locale);
  const hud = { prefix: strings.acting, done: strings.actDone };
  const disposables: Disposable[] = [];
  // --------------------------------------------------------------- open + read

  disposables.push(
    ctx.agent.registerTool({
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
    }),
  );

  disposables.push(
    ctx.agent.registerTool({
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
    }),
  );

  // ------------------------------------------------------------------- acting

  disposables.push(
    ctx.agent.registerTool({
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
            description:
              "Capture the canvas and return its path. Defaults to true.",
          },
          preview: {
            type: "boolean",
            description:
              "Open that capture in Astravia's own previewer so the user can see the editor. Defaults to true.",
          },
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
        return text({
          ok: reply.ok !== false,
          steps: reply.steps ?? [],
          elapsedMs: reply.elapsedMs ?? null,
          change: describeDelta(before, after),
          probe: after,
          shot: shot?.path ?? null,
          previewed,
        });
      },
    }),
  );

  disposables.push(
    ctx.agent.registerTool({
      id: `${id}_probe`,
      label: "%tool.probe%",
      description:
        `Look at the ${APP.name} canvas without changing it: a text map (one letter per cell — uppercase is ` +
        `bright, lowercase dark, K black, W white, R/G/B/C/M/Y/P hues, N neutral), the average colour of the ` +
        `region, and its contrast. Use \`region\` to inspect one part closely — the tool rail, a slider, the ` +
        `canvas centre — and a small \`columns\`/\`rows\` for a coarse overview. ` +
        `Set \`save\` when the user asked for a screenshot: that writes a real PNG the user picks a location ` +
        `for, which the model does not receive. ` +
        `Every call also writes a PNG into the project (\`.craft/shots/\`, newest six kept), returns its ` +
        `path as \`shot\`, and opens it in Astravia's own previewer so the user sees the editor too. ` +
        `Read the file when the answer depends on how the canvas actually looks.`,
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
        };
        if (!craftFrame()) return text({ ok: false, error: "editor-not-open" });
        const probe = await readCanvas({ region: input.region, columns: input.columns, rows: input.rows });
        if (!probe) return text({ ok: false, error: "probe-failed" });
        // The text map is the cheap reading; the picture is the one a person would look at.
        const shot = await saveCanvasShot(ctx, { region: input.region, scale: input.scale, tag: "probe" });
        const previewed = input.preview === false ? false : previewCanvasShot(ctx, shot);
        if (!input.save) return text({ ok: true, probe, shot: shot?.path ?? null, previewed });
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
        return text({ ok: true, probe, shot: shot?.path ?? null, previewed, path: saved, name: basename(saved) });
      },
    }),
  );


  // --------------------------------------------------------------------- settling

  // `act` returns when the last step has been dispatched, and a canvas app keeps
  // working after that: a filter recomputes, a slider re-renders, a wasm frame lands
  // two hundred milliseconds late. Without a way to wait, the model's next move was to
  // look immediately and find the picture half-drawn — then either describe that as the
  // result or click again on top of it. This waits for the map to stop changing and
  // says how long that took. It changes nothing in the page.

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  disposables.push(
    ctx.agent.registerTool({
      id: `${id}_wait`,
      label: "%tool.wait%",
      description:
        `Wait until the ${APP.name} canvas stops changing, then report what it settled on. ` +
        `Call it after \`${id}_act\` when that batch started something that takes time — apply ` +
        `a filter, render a preview, re-lay a page — so the next look is at the finished ` +
        `picture rather than a half-drawn one. ` +
        `\`quiet_ms\` is how long the cell map must stay identical to count as settled (default ` +
        `600 ms), \`probe_interval_ms\` is how often it looks (default 250 ms) and ` +
        `\`timeout_ms\` bounds the wait (default 20000 ms). ` +
        `A timeout is not an error: the reply carries \`settled: false\` and the last map, so a ` +
        `canvas that animates forever is reported as still moving instead of being retried. ` +
        `The reply carries \`change\`: how far the canvas travelled between the first and the ` +
        `last look — the honest answer to "did that batch do anything?" when the batch itself ` +
        `reported no error. ` +
        `It only reads: no clicks, no keys, no text.`,
      parameters: {
        type: "object",
        properties: {
          quiet_ms: {
            type: "number",
            description: "How long the map must stay identical to count as settled. Defaults to 600.",
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

        while (Date.now() - started < timeoutMs) {
          await sleep(intervalMs);
          const current = await readCanvas();
          if (!current) return text({ ok: false, error: "probe-failed", elapsedMs: Date.now() - started });
          looks += 1;
          last = current;
          // Two signals, either one enough: the letter map catches a small control that
          // moved without changing the average, the mean catches a full-screen fade.
          const moved = current.cells !== previous.cells || current.mean !== previous.mean;
          if (moved) stableSince = Date.now();
          previous = current;
          if (Date.now() - stableSince >= quietMs) {
            settled = true;
            break;
          }
        }

        const elapsedMs = Date.now() - started;
        const shot = settled && input.shot ? await saveCanvasShot(ctx, { tag: "wait" }) : null;
        const previewed = shot ? (input.preview === false ? false : previewCanvasShot(ctx, shot)) : false;
        return text({
          ok: true,
          settled,
          elapsedMs,
          looks,
          quietMs,
          change: describeDelta(first, last),
          probe: input.probe === false ? null : last,
          shot: shot?.path ?? null,
          previewed,
        });
      },
    }),
  );

  // -------------------------------------------------------------- open a file

  disposables.push(
    ctx.agent.registerTool({
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
    }),
  );

  return disposables;
}
