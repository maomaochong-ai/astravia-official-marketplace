import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../app.config.ts";
import { invokeMenu } from "../features/editor/services/menu.ts";
import { describeDelta } from "../features/editor/services/open-document.ts";
import { readCanvas } from "../features/editor/services/open-document.ts";
import { appendJournal } from "../features/editor/services/run-journal.ts";
import { craftFrame } from "../features/editor/session-registry.ts";
import { SCOPE, STEP_SCHEMA } from "./shared/schema.ts";
import { text } from "./shared/reply.ts";

/**
 * Use a function, by name.
 *
 * Every other tool here addresses the canvas: a click lands where a letter map says, and
 * `act` is the only way to produce one. That is the right shape for aiming at pixels and
 * the wrong shape for "export a PNG" — which is a command with a name, a shortcut and a
 * menu row, none of which the agent should have to rediscover as coordinates.
 *
 * So this tool takes the name. `shortcut` is the chord the app documents; `path` is the
 * menu route (`File > Export > Save for Web`). Both are tried, both are measured, and a
 * miss is reported with every attempt so the caller can fall back to `act` deliberately
 * instead of guessing why nothing happened.
 *
 * ADR: docs/adr/<slug>/craft-0029-address-the-function-not-the-pixel.md
 */
export function registerMenuTool(ctx: PluginContext): Disposable {
  const id = APP.id;

  return ctx.agent.registerTool({
    id: `${id}_menu`,
    label: "%tool.menu%",
    description:
      `Run a ${APP.name} command chosen by name rather than by coordinate. ` +
      `Give \`shortcut\` (the chord the app documents, e.g. "ctrl+shift+s") or \`path\` ` +
      `(the menu route, e.g. ["File", "Export", "Save for Web"]) — or both, in which case the ` +
      `shortcut is tried first. This is the cheapest way to reach a function: no probing, no ` +
      `coordinates, and it works wherever the command is in the menus. ` +
      `The reply says whether the canvas measurably changed after each attempt: ` +
      `\`invoked: false\` means the command did not run (wrong name, no mnemonic, or a modal ` +
      `dialog is in the way) — then try the other spelling, or fall back to \`${id}_act\` with ` +
      `\`region\` probes to find the control. ` +
      `\`change\` is the picture's own delta, so "it opened a dialog" and "nothing happened" ` +
      `are distinguishable.`,
    parameters: {
      type: "object",
      properties: {
        shortcut: {
          type: "string",
          description: `A chord such as "ctrl+s" or "cmd+shift+s". Tried before \`path\`.`,
        },
        path: {
          type: "array",
          items: { type: "string" },
          description: `Menu route, outermost first: ["File", "Export", "Save for Web"].`,
        },
        settle_ms: {
          type: "number",
          description: "How long to let the app draw after each keystroke. Defaults to 260.",
        },
        probe: {
          type: "boolean",
          description: "Include the canvas reading after the command. Defaults to true.",
        },
        region: STEP_SCHEMA.properties.region,
      },
      additionalProperties: false,
    },
    scope_use: [...SCOPE],
    timeoutMs: 60000,
    async handler(context) {
      const input = (context.trigger.input ?? {}) as {
        shortcut?: string;
        path?: string[] | string;
        settle_ms?: number;
        probe?: boolean;
        region?: { x: number; y: number; w: number; h: number };
      };
      if (!input.shortcut && !input.path) return text({ ok: false, error: "shortcut-or-path-required" });
      if (!craftFrame()) return text({ ok: false, error: "editor-not-open" });

      const before = await readCanvas({ region: input.region });
      const result = await invokeMenu({ path: input.path, shortcut: input.shortcut, settleMs: input.settle_ms });
      // The reading the assertion would use, and the picture the person can check.
      const after = input.probe === false ? null : await readCanvas({ region: input.region });
      const change = describeDelta(before, after);

      const journal = await appendJournal(ctx, {
        tool: "menu",
        shortcut: input.shortcut ?? null,
        path: input.path ?? null,
        invoked: result.invoked,
        step: result.step ?? null,
        change,
      });

      return text({
        ok: result.invoked,
        invoked: result.invoked,
        step: result.step ?? null,
        attempts: result.attempts,
        change,
        probe: after,
        journal,
        next: result.invoked
          ? "The command ran. Read `change` (and the shot from act/probe) before claiming what it did."
          : "Nothing the command tried moved the canvas. Check the name against references/menus.md, " +
            "close any modal dialog, or reach the control with act after a region probe.",
      });
    },
  });
}
