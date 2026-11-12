/**
 * The three questions a tool result must keep apart, checked at the source.
 *
 * `settled` (did the canvas go quiet), `change` (did anything happen) and `assert` (did
 * the thing I expected happen) are different answers, and an earlier build collapsed the
 * last one into the second: `distance > 6` was read as "it worked". These assertions pin
 * the shape of the fix — one tolerance, one comparison, an expectation that fails closed,
 * a trail on disk — plus the tool layout: one file per tool, so a schema change has one
 * home (ADR craft-0029).
 *
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

/** Every tool file concatenated: the surface, whichever file it lives in. */
function toolSources(app) {
  const dir = join(ROOT, app, "src/tools");
  const files = readdirSync(dir).filter((name) => name.endsWith(".ts"));
  return files.map((name) => readFileSync(join(dir, name), "utf8")).join("\n");
}

test("one tool per file, and the registry names them all", () => {
  const problems = [];
  const EXPECTED = ["act.ts", "editor-status.ts", "menu.ts", "open-document.ts", "open-editor.ts", "probe.ts", "recipe.ts", "wait.ts"];
  for (const app of APPS) {
    const dir = join(ROOT, app, "src/tools");
    if (existsSync(join(dir, "craft-tools.ts"))) problems.push(`${app}: the single-file surface is back`);

    for (const file of EXPECTED) {
      if (!existsSync(join(dir, file))) problems.push(`${app}: src/tools/${file} is missing`);
      else if (statSync(join(dir, file)).size === 0) problems.push(`${app}: src/tools/${file} is empty`);
    }

    // One `registerTool` per file: a file that registers two tools is the monolith again.
    for (const file of EXPECTED) {
      if (!existsSync(join(dir, file))) continue;
      const body = readFileSync(join(dir, file), "utf8");
      const registrations = (body.match(/\.agent\.registerTool\(/g) ?? []).length;
      if (registrations !== 1) problems.push(`${app}: src/tools/${file} registers ${registrations} tools`);
      const id = /id: `\$\{id\}_([a-z_]+)`/.exec(body);
      if (!id) problems.push(`${app}: src/tools/${file} declares no tool id`);
    }

    const index = read(app, "src/tools/index.ts");
    for (const file of EXPECTED) {
      const symbol = file.replace(/\.ts$/, "");
      if (!new RegExp(`${symbol}\\.ts`).test(index) && !new RegExp(`register[A-Z]\\w+Tool`).test(index)) {
        problems.push(`${app}: index.ts does not import ${symbol}`);
      }
    }
    if ((index.match(/register\w+Tool\(ctx\)/g) ?? []).length !== EXPECTED.length) {
      problems.push(`${app}: index.ts does not register every tool exactly once`);
    }
    // src/index.tsx has to point at the registry, not at a file that no longer exists.
    if (!/from "\.\/tools\/index\.ts"/.test(read(app, "src/index.tsx"))) {
      problems.push(`${app}: src/index.tsx does not import the tool registry`);
    }
  }
  assert.deepEqual(problems, []);
});

test("one tolerance, and both verdicts read it", () => {
  const problems = [];
  for (const app of APPS) {
    const expectation = read(app, "src/features/editor/services/expectation.ts");
    const tools = toolSources(app);
    const delta = read(app, "src/features/editor/services/open-document.ts");

    if (!/export const CHANGE_DISTANCE = 6;/.test(expectation)) problems.push(`${app}: CHANGE_DISTANCE is not 6`);
    if (!/export const CHANGE_DRIFT = 0\.02;/.test(expectation)) problems.push(`${app}: CHANGE_DRIFT is not 0.02`);
    // The threshold must live in one module and be imported, not restated per call site.
    if (/distance > 6|> 0\.02/.test(tools)) problems.push(`${app}: a tool restates a threshold`);
    if (/distance > 6|> 0\.02/.test(delta)) problems.push(`${app}: describeDelta restates a threshold`);
    if (!/CHANGE_DISTANCE/.test(delta) || !/CHANGE_DRIFT/.test(delta)) {
      problems.push(`${app}: describeDelta ignores the shared thresholds`);
    }
  }
  assert.deepEqual(problems, []);
});

test("wait settles on a tolerance, never on exact equality", () => {
  const problems = [];
  for (const app of APPS) {
    const wait = read(app, "src/tools/wait.ts");
    // The old loop compared the map and the mean string for exact identity.
    if (/current\.cells !== previous\.cells|current\.mean !== previous\.mean/.test(wait)) {
      problems.push(`${app}: _wait still compares for exact equality`);
    }
    if (!/describeDelta\(previous, current\)/.test(wait)) problems.push(`${app}: _wait does not measure a delta`);
    if (!/delta\.changed/.test(wait)) problems.push(`${app}: _wait ignores delta.changed`);
    // The diagnostic the ADR promises: how violently it moved while timing out.
    for (const field of ["maxDrift", "maxDistance"]) {
      if (!wait.includes(field)) problems.push(`${app}: _wait does not report ${field}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("act and probe both take an expectation and both report a verdict", () => {
  const problems = [];
  for (const app of APPS) {
    const schema = read(app, "src/tools/shared/schema.ts");
    const act = read(app, "src/tools/act.ts");
    const probe = read(app, "src/tools/probe.ts");

    if (!/export const EXPECT_SCHEMA = \{/.test(schema)) problems.push(`${app}: no EXPECT_SCHEMA`);
    for (const [name, body] of [["act", act], ["probe", probe]]) {
      if (!/expect: EXPECT_SCHEMA,/.test(body)) problems.push(`${app}: ${name} does not accept expect`);
      if (!/evaluateExpectation\(ctx, input\.expect, await readingFor\(input\.expect, /.test(body)) {
        problems.push(`${app}: ${name} does not assert against a reading`);
      }
      if (!/assert,/.test(body)) problems.push(`${app}: ${name} never returns the verdict`);
    }
    // `expect.region` must cost a focused probe, or the verdict is about the wrong pixels.
    if (!/expect\?\.region/.test(read(app, "src/tools/shared/reading.ts"))) {
      problems.push(`${app}: expect.region is accepted but ignored`);
    }
  }
  assert.deepEqual(problems, []);
});

test("a function can be addressed by name, and a miss is reported", () => {
  const problems = [];
  for (const app of APPS) {
    if (!existsSync(join(ROOT, app, "src/features/editor/services/menu.ts"))) {
      problems.push(`${app}: no menu service`);
      continue;
    }
    const menu = read(app, "src/tools/menu.ts");
    const service = read(app, "src/features/editor/services/menu.ts");

    // Shortcut first, path second: the cheap keystroke is the one the app documents.
    if (!/invoked/.test(menu)) problems.push(`${app}: menu tool reports no verdict`);
    if (!/attempts/.test(menu)) problems.push(`${app}: menu tool does not report attempts`);
    if (!/shortcut/.test(service) || !/alt\+/.test(service)) problems.push(`${app}: menu service has no keyboard route`);
    if (!/normalizePath/.test(service)) problems.push(`${app}: menu service does not accept a joined path`);
    if (!/mnemonicOf/.test(service)) problems.push(`${app}: menu service does not derive mnemonics`);
  }
  assert.deepEqual(problems, []);
});

test("every call leaves a trail, one file per day, seven days kept", () => {
  const problems = [];
  for (const app of APPS) {
    const journal = read(app, "src/features/editor/services/run-journal.ts");
    const tools = toolSources(app);
    if (!/export const JOURNAL_DIR = `\.craft\/\$\{APP\.id\}\/runs`;/.test(journal)) {
      problems.push(`${app}: the journal is not project-local under .craft/<app>/runs`);
    }
    if (!/export const JOURNAL_KEEP = 7;/.test(journal)) problems.push(`${app}: the journal keeps the wrong number of days`);
    // act, probe, wait, menu and recipe each record a line: five tools, five trails.
    if ((tools.match(/appendJournal\(ctx, \{/g) ?? []).length !== 5) {
      problems.push(`${app}: act, probe, wait, menu and recipe must each record a line`);
    }
  }
  assert.deepEqual(problems, []);
});

test("the skill tells the model the same three words", () => {
  const problems = [];
  for (const app of APPS) {
    const skill = readFileSync(join(ROOT, app, "agent/skills", app, "SKILL.md"), "utf8");
    // The old sentence promised exact equality; it would now be a lie.
    if (/连续 600 ms 不变就算落定/.test(skill)) problems.push(`${app}: the skill still promises an identical map`);
    for (const needle of ["`assert.ok`", "remember_as", `\`.craft/${app}/runs/`, `\`.craft/${app}/baseline/`]) {
      if (!skill.includes(needle)) problems.push(`${app}: the skill never mentions ${needle}`);
    }
    // The section that keeps `settled`, `change` and `assert` apart. Its wording is the
    // skill's own business; its presence is not.
    if (!/判对错|判"做对没有"/.test(skill)) problems.push(`${app}: the skill has no section on the verdict`);
    if (!/references\/commands\.md/.test(skill)) problems.push(`${app}: the skill never points at the command table`);
  }
  assert.deepEqual(problems, []);
});
