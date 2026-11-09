import { CHANGE_DISTANCE, CHANGE_DRIFT } from "../../features/editor/services/expectation.ts";

/**
 * The shapes the model sees. One file, because a tool's parameters are a contract and two
 * tools that disagree about the same field is how a schema rots.
 *
 * ADR: docs/adr/<slug>/craft-0009-one-batch-and-a-text-map.md
 * ADR: docs/adr/<slug>/craft-0026-act-says-what-it-expects.md
 */

/** Both scopes: an editor is used from a conversation and from a project. */
export const SCOPE = ["conversation", "project"] as const;

/** Steps the bridge understands; `act` runs them, `menu` reuses only `region`. */
export const STEP_SCHEMA = {
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

/**
 * What the caller expected to be true when the batch finished.
 *
 * `change` says the picture moved; this says it moved the right way. The schema sits next
 * to `STEP_SCHEMA` because both are read by `act`, and `probe` reuses it so there is one
 * shape for one question.
 */
export const EXPECT_SCHEMA = {
  type: "object",
  properties: {
    region: STEP_SCHEMA.properties.region,
    meanRgb: {
      type: "array",
      items: { type: "number" },
      minItems: 3,
      maxItems: 3,
      description: "The average colour you expect, 0–255 per channel, as [r, g, b].",
    },
    distance: {
      type: "number",
      description: `How far the average may sit from that colour. Defaults to ${CHANGE_DISTANCE}.`,
    },
    against: {
      type: "string",
      enum: ["baseline"],
      description:
        "Compare with the reading saved under `name` instead of a literal colour. " +
        "A missing baseline fails the assertion — it never silently passes.",
    },
    name: { type: "string", description: "Baseline name; `current` when absent." },
    text: {
      type: "string",
      description: "What you expected, in the user's language. Echoed back; never judged.",
    },
  },
  additionalProperties: false,
} as const;

/** How long a menu must stay quiet to be counted as having opened. */
export const MENU_SETTLE_MS = 220;

export { CHANGE_DISTANCE, CHANGE_DRIFT };
