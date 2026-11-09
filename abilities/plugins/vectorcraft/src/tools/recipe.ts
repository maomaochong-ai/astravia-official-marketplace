import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../app.config.ts";
import { invokeMenu } from "../features/editor/services/menu.ts";
import { describeDelta, readCanvas } from "../features/editor/services/open-document.ts";
import { appendJournal } from "../features/editor/services/run-journal.ts";
import { craftFrame } from "../features/editor/session-registry.ts";
/**
 * What a recipe is, stated here so the tool compiles the same way in a plugin with eight
 * recipes and in one with none. `app.config.ts` stays data; this is its shape.
 */
interface RecipeStep {
  shortcut?: string;
  menu?: readonly string[];
}

interface Recipe {
  id: string;
  label: string;
  when: string;
  steps: readonly RecipeStep[];
}

/** One line per step, in the order they ran. */
interface RecipeStepResult {
  index: number;
  /** The chord, or the menu route, exactly as the recipe spells it. */
  what: string;
  ok: boolean;
  error?: string;
}
import { SCOPE } from "./shared/schema.ts";
import { text } from "./shared/reply.ts";

/**
 * One name, one chore.
 *
 * `menu` runs a single command; this runs the sequence a person actually asks for ("save
 * it", "export a PNG") as one id. The sequences live in `app.config.ts` — the only file
 * that may differ per app — and every step in them is a command this editor exposes, so a
 * recipe never guesses a coordinate and never depends on window size or zoom.
 *
 * A recipe that cannot run says so: `invoked: false` plus the step that failed. That is the
 * point of having recipes at all — a chore either completes, or names the step that did not.
 *
 * ADR: docs/adr/<slug>/craft-0029-address-the-function-not-the-pixel.md
 * ADR: docs/adr/<slug>/craft-0030-a-recipe-is-the-unit-of-automation.md
 */
export function registerRecipeTool(ctx: PluginContext): Disposable {
  const id = APP.id;
  // Typed here, not inferred from `APP.recipes`: an app with no recipes declares
  // `recipes: []`, whose element type is `never`, and every field access on it would be an
  // error in that plugin only. Same code, same types, all fifteen.
  const recipes: readonly Recipe[] = APP.recipes ?? [];
  const catalogue = recipes.map((recipe) => `${recipe.id}（${recipe.label}）`).join("、");

  return ctx.agent.registerTool({
    id: `${id}_recipe`,
    label: "%tool.recipe%",
    description:
      `Run one named chore in ${APP.name} as a single call. Each recipe is a short sequence of ` +
      `commands this editor exposes (its own shortcut, or a menu route), so nothing is guessed ` +
      `from the picture. Available here: ${catalogue || "none in this build — use act and probe"}. ` +
      `Pass \`id\`; \`{"list": true}\` returns the same list with what each one does. ` +
      `The reply reports every step, and a measured canvas delta, so "saved" or "exported" is ` +
      `something the picture confirms. \`invoked: false\` means the chore did not complete: read ` +
      `\`steps\` for the one that failed, then run it alone with \`${id}_menu\` or reach the control ` +
      `with \`${id}_act\`. Recipes never save under a name the user did not choose: \`save\` writes ` +
      `the open document, and anything that asks for a path shows the app's own dialog.`,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Recipe id, e.g. `save` or `export`." },
        list: { type: "boolean", description: "Return the recipes instead of running one." },
        settle_ms: {
          type: "number",
          description: "How long to let the app draw after each step. Defaults to 260.",
        },
        probe: { type: "boolean", description: "Include the canvas reading after the run. Defaults to true." },
      },
      additionalProperties: false,
    },
    scope_use: [...SCOPE],
    timeoutMs: 90000,
    async handler(context) {
      const input = (context.trigger.input ?? {}) as {
        id?: string;
        list?: boolean;
        settle_ms?: number;
        probe?: boolean;
      };

      if (input.list || !input.id) {
        return text({
          ok: true,
          invoked: null,
          recipes: recipes.map((recipe) => ({
            id: recipe.id,
            label: recipe.label,
            when: recipe.when,
            steps: recipe.steps,
          })),
          next:
            recipes.length > 0
              ? `Call with {"id": "<one of the above>"}.`
              : "This build exposes no named commands; use act with a region probe instead.",
        });
      }

      const recipe = recipes.find((candidate) => candidate.id === input.id);
      if (!recipe) {
        return text({
          ok: false,
          invoked: false,
          error: "unknown-recipe",
          available: recipes.map((candidate) => candidate.id),
        });
      }
      if (!craftFrame()) return text({ ok: false, invoked: false, error: "editor-not-open" });

      const before = await readCanvas();
      const steps: RecipeStepResult[] = [];
      let completed = true;

      for (const [index, step] of recipe.steps.entries()) {
        // A recipe step is either a chord or a menu route; the union is narrowed here so the
        // service never receives a `menu` it cannot walk.
        // Narrow by hand: `in` on an optional property still leaves `undefined` in the type,
        // and a readonly array is not iterable for the compiler unless it knows it is one.
        const shortcut = "shortcut" in step && typeof step.shortcut === "string" ? step.shortcut : undefined;
        const path =
          "menu" in step && Array.isArray(step.menu) && step.menu.length > 0 ? [...step.menu] : undefined;
        const what = shortcut ?? (path ?? []).join(" › ");
        const result = await invokeMenu({ shortcut, path, settleMs: input.settle_ms });
        const entry: RecipeStepResult = { index: index + 1, what, ok: result.invoked };
        if (!result.invoked) entry.error = "did-not-run";
        steps.push(entry);
        if (!result.invoked) {
          completed = false;
          break;
        }
      }

      const after = input.probe === false ? null : await readCanvas();
      const change = describeDelta(before, after);
      const journal = await appendJournal(ctx, {
        tool: "recipe",
        id: recipe.id,
        completed,
        steps: steps.map((step) => ({ what: step.what, ok: step.ok })),
        change,
      });

      return text({
        ok: completed,
        invoked: completed,
        id: recipe.id,
        label: recipe.label,
        steps,
        change,
        probe: after,
        journal,
        next: completed
          ? `"${recipe.label}" ran. Read \`change\` before telling the user it worked, and check the ` +
            `document itself when the recipe saves or exports.`
          : `Step ${steps.at(-1)?.index} ("${steps.at(-1)?.what}") did not run. Try it alone with ` +
            `${id}_menu, close any open dialog, or reach the control with ${id}_act.`,
      });
    },
  });
}
