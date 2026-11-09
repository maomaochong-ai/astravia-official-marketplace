/**
 * Does this plugin actually automate anything?
 *
 * A skill can describe work forever and still leave the user clicking. What makes a chore
 * automatable here is that it exists as data: a recipe in `app.config.ts`, made of commands
 * the editor really exposes, executable by the `recipe` tool, and listed for the model in
 * `references/recipes.md`. This test holds those four things to each other, per plugin:
 *
 *   - every recipe step is addressable — a shortcut, or a menu route it can actually walk;
 *   - every menu route and shortcut it claims exists in `references/commands.md`;
 *   - the recipes the config carries are exactly the recipes the skill documents;
 *   - the tool registers, is one file, and reports a verdict per step.
 *
 * It is the difference between "the skill says you can export" and "export exists".
 *
 * ADR: docs/adr/<plugin>/craft-0030-a-recipe-is-the-unit-of-automation.md
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../abilities/plugins/", import.meta.url));
const APPS = [
  "designcraft", "effectcraft", "filmcraft", "lightcraft", "pdfcraft", "vectorcraft", "photocraft",
  "cadcraft", "deckcraft", "figcraft", "gridcraft", "wordcraft", "texturecraft", "materialcraft",
  "craft-anything",
];

const read = (app, file) => readFileSync(join(ROOT, app, file), "utf8");

/** `commands.md` as data: the id, the shortcut and the route each command row carries. */
function commandIndex(app) {
  const text = read(app, `agent/skills/${app}/references/commands.md`);
  const rows = [];
  for (const line of text.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 6 || cells[1] === "功能" || cells[1].startsWith("---")) continue;
    const [, label, shortcut, path, id] = cells;
    if (!id?.startsWith("`")) continue;
    rows.push({
      label,
      shortcut: shortcut === "—" ? "" : shortcut,
      path: path === "—" ? null : JSON.parse(path.replace(/`/g, "")),
      id: id.replace(/`/g, ""),
    });
  }
  return rows;
}

/**
 * The recipes embedded in `app.config.ts`. Read with a regex rather than by importing: the
 * file is TypeScript with `as const`, and the point is the literal data it ships.
 */
function recipesOf(app) {
  // The skills and configs are CRLF in this repo; newline style is not what is under test.
  const text = read(app, "src/app.config.ts").replace(/\r\n/g, "\n");
  const block = /recipes: (\[[\s\S]*?\]),\n} as const;/.exec(text)?.[1];
  if (!block) return [];
  if (block.trim() === "[]") return [];
  const out = [];
  // A recipe ends at `] },`; the lazy body keeps the menu arrays inside it intact.
  for (const match of block.matchAll(/\{ id: ("[^"]+"), label: ("[^"]+"), when: ("[^"]+"), steps: \[([\s\S]*?)\] \},/g)) {
    const steps = [];
    for (const step of match[4].matchAll(/\{ (shortcut|menu): (.+?) \}/g)) {
      const value = step[2];
      steps.push(step[1] === "shortcut" ? { shortcut: JSON.parse(value) } : { menu: JSON.parse(value) });
    }
    out.push({ id: JSON.parse(match[1]), label: JSON.parse(match[2]), when: JSON.parse(match[3]), steps });
  }
  return out;
}

test("every recipe is made of commands this editor really exposes", () => {
  const problems = [];
  for (const app of APPS) {
    const rows = commandIndex(app);
    const shortcuts = new Set(rows.map((row) => row.shortcut).filter(Boolean));
    const routes = new Set(rows.filter((row) => row.path).map((row) => JSON.stringify(row.path)));

    for (const recipe of recipesOf(app)) {
      if (recipe.steps.length === 0) problems.push(`${app}/${recipe.id}: no steps`);
      for (const step of recipe.steps) {
        if (step.shortcut) {
          if (!shortcuts.has(step.shortcut)) {
            problems.push(`${app}/${recipe.id}: shortcut ${step.shortcut} is not in the command index`);
          }
          continue;
        }
        if (!step.menu || step.menu.length === 0) {
          problems.push(`${app}/${recipe.id}: a step with neither shortcut nor route`);
          continue;
        }
        if (!routes.has(JSON.stringify(step.menu))) {
          problems.push(`${app}/${recipe.id}: route ${step.menu.join(" > ")} is not in the command index`);
        }
      }
      const ids = recipe.steps.map((step) => step.shortcut ?? step.menu.join(">"));
      if (new Set(ids).size !== ids.length) problems.push(`${app}/${recipe.id}: the same step twice`);
    }
  }
  assert.deepEqual(problems, []);
});

test("the skill documents exactly the recipes the plugin carries", () => {
  const problems = [];
  for (const app of APPS) {
    const config = recipesOf(app);
    const doc = read(app, `agent/skills/${app}/references/recipes.md`);
    const skill = read(app, `agent/skills/${app}/SKILL.md`);

    for (const recipe of config) {
      if (!doc.includes(`\`${recipe.id}\``)) problems.push(`${app}: recipes.md does not list ${recipe.id}`);
      if (!skill.includes(`\`${recipe.id}\``)) problems.push(`${app}: SKILL.md does not offer ${recipe.id}`);
    }
    // And nothing invented in the docs: every id named there has to exist in the config.
    const known = new Set(config.map((recipe) => recipe.id));
    for (const match of doc.matchAll(/^\| `([a-z0-9-]+)` \|/gm)) {
      if (!known.has(match[1])) problems.push(`${app}: recipes.md documents unknown ${match[1]}`);
    }
    if (config.length === 0 && !/没有成套动作|没有可以按名字调用的命令/.test(doc)) {
      problems.push(`${app}: an app with no recipes must say so in recipes.md`);
    }
  }
  assert.deepEqual(problems, []);
});

test("the recipe tool executes them and reports a verdict", () => {
  const problems = [];
  for (const app of APPS) {
    const path = join(ROOT, app, "src/tools/recipe.ts");
    if (!existsSync(path)) {
      problems.push(`${app}: src/tools/recipe.ts is missing`);
      continue;
    }
    const body = readFileSync(path, "utf8");
    if ((body.match(/\.agent\.registerTool\(/g) ?? []).length !== 1) problems.push(`${app}: recipe.ts registers more than one tool`);
    if (!/id: `\$\{id\}_recipe`/.test(body)) problems.push(`${app}: the tool id is not <app>_recipe`);
    // It has to read the per-app data, and it has to say what happened per step.
    if (!/APP\.recipes/.test(body)) problems.push(`${app}: recipe.ts ignores APP.recipes`);
    if (!/invoked: completed/.test(body)) problems.push(`${app}: recipe.ts reports no run verdict`);
    if (!/steps,/.test(body)) problems.push(`${app}: recipe.ts does not return the steps`);
    if (!/unknown-recipe/.test(body)) problems.push(`${app}: an unknown id is not reported`);
    if (!/appendJournal\(ctx, \{/.test(body)) problems.push(`${app}: recipe runs leave no trail`);

    const index = read(app, "src/tools/index.ts");
    if (!/registerRecipeTool\(ctx\)/.test(index)) problems.push(`${app}: the registry does not register recipe`);
  }
  assert.deepEqual(problems, []);
});

test("a plugin with no addressable commands says so instead of pretending", () => {
  const problems = [];
  for (const app of APPS) {
    const rows = commandIndex(app);
    const recipes = recipesOf(app);
    if (rows.length === 0 && recipes.length > 0) problems.push(`${app}: recipes exist for an app with no command index`);
    // Every app must still ship the two reference files, so the model has one place to look.
    for (const file of ["commands.md", "recipes.md"]) {
      if (!existsSync(join(ROOT, app, "agent/skills", app, "references", file))) {
        problems.push(`${app}: references/${file} is missing`);
      }
    }
  }
  assert.deepEqual(problems, []);
});
