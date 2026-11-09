/**
 * The skills are this plugin's own: an index, a recipe table, and a playbook. Anything
 * copied from a manual, and any wording that points at "upstream", is a leftover.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = "D:/open-source-projects/astravia-official-marketplace/abilities/plugins";
const APPS = [
  "designcraft", "effectcraft", "filmcraft", "lightcraft", "pdfcraft", "vectorcraft", "photocraft",
  "cadcraft", "deckcraft", "figcraft", "gridcraft", "wordcraft", "texturecraft", "materialcraft",
  "craft-anything",
];

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

test("a skill ships only what this plugin authored", () => {
  const problems = [];
  for (const app of APPS) {
    const refs = join(ROOT, app, "agent/skills", app, "references");
    const files = readdirSync(refs).sort();
    const allowed = ["commands.md", "recipes.md"];
    for (const file of files) {
      if (!allowed.includes(file)) problems.push(`${app}: references/${file} is not an authored file`);
    }
    for (const file of allowed) {
      if (!files.includes(file)) problems.push(`${app}: references/${file} is missing`);
    }
  }
  assert.deepEqual(problems, []);
});

test("no skill calls itself a copy of somebody else's documentation", () => {
  // The complaint that started this: the skill read as a downloaded manual. These words
  // are the fingerprint of that, so they are banned rather than merely discouraged.
  const banned = ["upstream", "上游文档", "上游仓库", "上游自述", "使用指南", "说明书", "readme"];
  const problems = [];
  for (const app of APPS) {
    const dir = join(ROOT, app, "agent/skills", app);
    for (const file of walk(dir)) {
      if (!file.endsWith(".md")) continue;
      const text = readFileSync(file, "utf8").toLowerCase();
      for (const word of banned) {
        if (text.includes(word.toLowerCase())) {
          problems.push(`${app}: ${file.slice(ROOT.length + 1)} mentions "${word}"`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("every skill describes the eight tools it actually has", () => {
  const problems = [];
  for (const app of APPS) {
    const skill = readFileSync(join(ROOT, app, "agent/skills", app, "SKILL.md"), "utf8");
    for (const tool of [
      "open_editor", "editor_status", "recipe", "menu", "act", "probe", "wait", "open_document",
    ]) {
      if (!skill.includes(`\`${app}_${tool}\``)) problems.push(`${app}: SKILL.md never names ${app}_${tool}`);
    }
    if (!/^name: [a-z-]+$/m.test(skill)) problems.push(`${app}: SKILL.md has no name field`);
    if (!/^alias: /m.test(skill)) problems.push(`${app}: SKILL.md has no alias`);
    if (!/^description: "/m.test(skill)) problems.push(`${app}: description must be quoted`);
  }
  assert.deepEqual(problems, []);
});

test("no skill file is bigger than the session can afford", () => {
  const CEILING = 40 * 1024;
  const problems = [];
  for (const app of APPS) {
    const dir = join(ROOT, app, "agent/skills", app);
    const bytes = walk(dir).reduce((sum, file) => sum + readFileSync(file).length, 0);
    if (bytes > CEILING) problems.push(`${app}: ${(bytes / 1024).toFixed(0)} KB`);
    // The guidance file the model always loads must stay well inside that.
    const skill = readFileSync(join(dir, "SKILL.md")).length;
    if (skill > 20 * 1024) problems.push(`${app}: SKILL.md alone is ${(skill / 1024).toFixed(0)} KB`);
  }
  assert.deepEqual(problems, []);
  assert.ok(!existsSync(join(ROOT, "craft-anything/agent/skills/craft-anything/references/upstream.md")));
});
